# CODE-REVIEW-291-r1

- **Issue:** #291 «Барьер записи координат: убрать шум как явление»
- **Этап:** код-ревью (PROCESS.md §2.7), заход **r1** (первый заход код-ревью;
  ревью ТЗ прошло отдельно, 3 захода, зелёное на r3 — сюда не засчитывается,
  §10.4 «цикл считается по этапу»)
- **Диапазон:** `10fa0dc7..81d2a801` (merge-base с `origin/dev` .. HEAD ветки
  `issue/291-lattice-coordinate-barrier`), 10 коммитов, 37 файлов, +2374/-328
- **ТЗ:** `docs/specs/291-lattice-coordinate-write-barrier.md`, зелёное ревью
  `SPEC-REVIEW-291-r3.md`
- **Ревьюер:** свежая сессия, без контекста реализации; артефакты читаны из
  ветки, а не со слов автора

## Скоуп

Единый барьер записи, приводящий координаты, лежащие ближе `1e-4` шага сетки
к узлу `k/240`, к точному double этого узла — во frontend и backend, в layout
и config, с отдельным отчётом Optimize и защитой от обхода. Не входит: смена
схемы хранения, #288/#289/#290, union-алгоритм #278, снап авторской off-grid
геометрии. Это первый код-ревью раунд — предмет разбора полный, дельты по
предыдущему раунду нет.

## Как проверялось

Гейты по PROCESS.md §8, соразмерно задаче (диапазон трогает `src/**`,
`custom_components/**/*.py`, геометрию и ссылки на неё):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1232 passed, 1 skipped, 0 failed |
| Build + bundle parity | `npm run build && npm run bundle:sync` + `cmp` трёх копий | `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/` побайтово идентичны |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» — обязателен, diff трогает `src/**` |
| Model invariants | `node scripts/model-invariants.mjs --config <real-plan-first-floor.json как config> --lattice` (сам, до и после `canonicalizeConfigGeometry`) | до барьера: шум 66.15% (127/192), совпадает по порядку с измерением issue (65.38%/78.77%); после барьера: **шум 0 (0.00%)**, законно вне сетки 2 (1.04%) — воспроизводит формат AC3 буквально; второй прогон канонизации байт-в-байт идентичен первому (AC1/AC4 idempotence на живых данных, исполнено, не только прочитано) |
| Model invariants (violations) | `node scripts/model-invariants.mjs --config <migrated>` | «Инварианты выполнены»; 2 наблюдения (exact-endpoint fallback) — не нарушения, не относится к #291 |
| Mutation gate (структурная проверка) | `node scripts/mutation-gate.mjs --check` | все 180 патчей (включая 6 новых lattice-мутантов) применяются к текущему коду ровно один раз |
| Mutation gate (полный прогон, выборочно) | `--id=lattice-round-truncates`, `--id=frontend-writes-raw-coords` | оба: мутант применён → именованный тест **покраснел**, гейт зафиксировал ловлю. `--id=optimize-config-storage-half-raw` (backend-мутант, переиспользованный из #248 для «direct backend Store bypass») упал на отсутствии `pytest`/`homeassistant` в этой среде — не показатель дефекта, показатель среды (см. «Не проверял») |
| Performance (AC11) | `node demo/benchmark_coordinate_write_barrier.mjs` | ratio 0.666 (лимит 1.2) — независимый локальный прогон, не только цифра автора (0.823, тоже под лимитом) |
| Smoke — выбор | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 3 «прямых совпадения» (`cellCm`) + 1 «зарегистрированная связь» (`repairSpaceReferences`) — вывод приложен ниже |
| Smoke — по AC | `node demo/smoke_lattice_write_barrier.mjs`, `node demo/smoke_optimize_coordinate_canonicalization.mjs` | оба **OK**, все под-проверки true |
| Smoke — по выбору | `smoke_decor`, `smoke_grid_scale_invariance`, `smoke_space_scale_defaults`, `smoke_orphan_space_references` | все **OK** |
| Backend | `python -m pytest tests_backend/test_coordinate_canonicalization.py -q` | **не выполнено** — в среде ревью нет `homeassistant` (`ModuleNotFoundError`), см. «Не проверял» |
| Golden | не прогонялся | сознательное решение, см. «Не проверял» |
| Полный набор смоков (182 файла) | не прогонялся | вне объёма код-ревью (PROCESS.md §8: «полные наборы — предрелизный гейт») |
| Process gate | `node scripts/process-gate.mjs --github-range --issues` локально на HEAD | «гейт пройден, предупреждений 0» |

Вывод `smoke-select.mjs`:

```
Изменено файлов src/**: 3 · символов проекта на изменённых строках: 26
Прямое совпадение (3): smoke_decor.mjs ← cellCm; smoke_grid_scale_invariance.mjs ← cellCm;
  smoke_space_scale_defaults.mjs ← cellCm
Зарегистрированная связь (1): smoke_orphan_space_references.mjs ← repairSpaceReferences
```
Все четыре прогнаны (таблица выше), все зелёные.

### CI на ветке — что нашёл и как учёл

Validate на коммите с реализацией (`9a42c856`, run 32732620838) завершился
**cancelled**, с `process-gate: failure` и `docs: failure`; `golden`/`smoke`/
`performance_smoke` не завершились (`cancelled`), потому что следующий пуш
(`81d2a801`) отменил незавершённый прогон (штатное поведение
`concurrency.cancel-in-progress`, AGENTS.md). Разобрал каждую причину:

- `docs: failure` — ожидаемо, отпечаток скриншотов был устаревшим; закрыто тем
  же следующим коммитом (`docs: accept screenshots for lattice barrier`);
- `process-gate: failure` — `git cat-file -e 89f8b581...^{commit}` не находит
  объект: `BEFORE_SHA` ссылался на коммит, переписанный до этого пуша
  (амend/форс на личной ветке задачи, что процессом не запрещено). Транзиентная
  инфраструктурная причина, не нарушение правил — на финальном HEAD
  `process-gate` зелёный и в CI (run 32732834660), и в моём локальном прогоне;
- `golden`/`smoke`/`performance_smoke` для финального HEAD в CI **не
  запускались вовсе** — на ветках задач `changes`-job фильтрует по diff
  последнего пуша (а не всей ветки), и пуш `81d2a801` тронул только
  `docs/images/**`. Это осознанный дизайн (`validate.yml`: «настоящую приёмку
  там делает код-ревью, которое гоняет гейты само, #127») — то есть именно
  код-ревью (эта сессия), а не CI, отвечает за targeted-гейты, что я и сделал
  выше.

Ссылка автора в хендоффе («Linux backend … зелёный in Validate 32732620838»)
точна для job `backend`, но не упоминает, что сам прогон был `cancelled` и
два job упали — это не искажение факта, но неполная картина. Отмечаю как
наблюдение, не как находку: обе причины разобраны и не относятся к
поведению #291.

## AC — построчно

| AC | Доказательство | Вердикт |
|---|---|---|
| AC1 Идемпотентность/точные биты | `test/coordinate-canonicalization.test.mjs`: цикл по 4801 узлам, идемпотентность, `-0`→`+0`, `0.06`/`0.2875` не снапятся, граница `1e-4` в обе стороны — плюс мой прогон на живой фикстуре (см. таблицу) | ✅ доказано автотестом + исполнением |
| AC2 Shared allow-list parity | одна fixture (`test/fixtures/coordinate-canonicalization.json`), deep-equal TS/Python (`test_python_and_frontend_share_the_scalar_lattice_fixture_contract`), input immutable | ✅ доказано автотестом (TS выполнен; Python — проверено чтением, см. «Не проверял») |
| AC3 Живой профиль после migration = 0 | `test/model-invariants.test.mjs`: `real-plan-*.json` clone → `profile.noise===0`, `far===measured.far`, `checkWallKeys`/`checkMixedRoleRecords` = 0, raw file byte-equal до/после — плюс мой независимый прогон CLI на `real-plan-first-floor.json` (66.15%→0.00%, идемпотентность подтверждена вторым прогоном) | ✅ доказано автотестом + исполнением |
| AC4 Произвольная editing session не возвращает noise | **см. находку M1** — нет production-bundle smoke, который бы рисовал/продолжал Walls chain, делал Resize, ставил opening/partition/column/decor, двигал marker/room label и проверял `latticeProfile.noise===0` после каждого шага, как требует буква AC | ⚠️ не доказано ни тестом, ни явной записью «проверено чтением» — структурно вероятно верно (AC5+AC1), но не показано |
| AC5 Write barrier нельзя обойти | `test/coordinate-write-barrier-guard.test.mjs` (инвентарь всех 4 frontend-writer'ов + 2 backend Store boundary в `store.py`); мутанты `frontend-writes-raw-coords` (#224, переиспользован) и `optimize-config/layout-storage-half-raw` (#248, переиспользован) целятся именно в bypass; первый прогнан мной полностью и покраснел как положено | ✅ доказано автотестом (frontend выполнено; backend-мутант не выполнен, см. «Не проверял») |
| AC6 Source fixtures остаются шумными | `test('барьер очищает клоны реальных планов, не переписывая source fixtures (#291)')`: `readFileSync` до/после теста байт-в-байт равны; `profile.noise >= 100` пин остаётся | ✅ доказано автотестом, выполнено |
| AC7 Optimize report и transaction | `smoke_optimize_coordinate_canonicalization.mjs` (17/17 true, выполнено мной), `test/plan-optimizer.test.mjs` (идемпотентность, `latticeCoordinatesCanonicalized`/`Far` не путается с `coordsCanonicalized`, лёгко проверяемый порядок: барьер применяется **до** `alignAllToGrid`, поэтому align не видит уже исправленный шум и не задваивает счётчик — проверено чтением `plan-optimizer.ts:415-420` и подтверждено тем, что `coordsCanonicalized===0` рядом с `latticeCoordinatesCanonicalized>0` в тесте «issue 273»/«ULP source») | ✅ доказано автотестом + smoke, выполнено |
| AC8 Compatibility paths | `test_backend_schemas_apply_the_same_allowlist`, `optimize-storage-roundtrip.json`, `280-optimize-rehost-candidate.json` обновлены канонизацией; no schema/version bump подтверждён (модель/сторедж не тронуты) | ✅ проверено чтением + существующими тестами (backend часть не исполнена мной) |
| AC9 Polyclip/#278 regression | `npm test` включает все 5 тестов `#278 …` (1207-1211), все зелёные; барьер не трогает `physical-geometry.ts`/union | ✅ доказано автотестом, выполнено |
| AC10 Мутанты | 6 новых lattice-мутантов + 2 переиспользованных (#224/#248) закрывают все 6 категорий буквы AC10 (round→truncate TS+Python, threshold too small/large, layout allow-list omission, unknown-field recursion, frontend writer bypass, backend Store bypass). `--check` зелёный на всех 180; полностью прогнаны мной 2 из 8 релевантных (TS-side); backend-мутант не прогнан (среда) | ✅ доказано структурно + частично исполнением, backend — проверено чтением |
| AC11 Performance | `demo/benchmark_coordinate_write_barrier.mjs`, ratio 0.666 (я) / 0.823 (автор), лимит 1.2; линейный один проход, без второго deep-clone (проверено чтением `plan-optimizer.ts`: `canonicalizeConfigGeometryInPlace` работает по месту, autor явно закомментировал это решение) | ✅ доказано автотестом/бенчмарком, выполнено |
| AC12 Локальные гейты | typecheck/test/build/bundle-parity/check-docs — выполнены (таблица выше); backend — не выполнен (среда) | ✅/⚠️ частично, см. «Не проверял» |

## Находки

### M1 (Medium, в скоупе) — AC4 не доказан ни автотестом, ни явной записью

AC4 требует production-bundle smoke, который **последовательно**: рисует/
продолжает Walls chain → Resize → ставит/двигает opening/partition/column/
decor → двигает device marker и room label → делает config/layout write,
reload, export — и после **каждого** commit проверяет
`latticeProfile.noise === 0`. Ни один смок в диффе (новый
`smoke_lattice_write_barrier.mjs`, обновлённый
`smoke_optimize_coordinate_canonicalization.mjs`) этого не делает:
`smoke_lattice_write_barrier.mjs` подаёт шумные данные напрямую в
`card._serverCfg`/`card._layout` и проверяет 4 writer-call-site, минуя
контроллеры инструментов (wall chain, resize, opening/partition/column/decor,
drag маркера/подписи). Ни одного смока в репозитории, ссылающегося на
`latticeProfile`, я не нашёл (`grep -rl latticeProfile demo/*.mjs` — пусто).

Структурно AC5 (единый барьер, непроходимый) + AC1 (сама функция корректна)
делают результат весьма вероятным без отдельного прогона — но это не то же
самое, что показать его для реальных контроллеров, которые формируют
кандидат разными путями (snap при рисовании, resize-пересчёт, поворот
проёма). Именно ради этой уверенности AC4 сформулирован отдельно от AC5, и
именно эту рамку (§7.1: «либо автотест, либо явная запись ревьюера») сейчас
не закрывает ни тест, ни хендофф-комментарий автора (там нет фразы вида
«AC4 закрыт составом AC1+AC5, отдельный смок не написан»).

**Воспроизведение отсутствия:** `grep -rl "latticeProfile\|noise === 0" demo/*.mjs` → пусто;
diff не трогает ни один из смоков с реальными жестами (`smoke_wall_chain_*`,
`smoke_room_resize`, `smoke_opening_preview`, `smoke_free_walls` и т.п.).

**Правка:** либо добавить проверку `latticeProfile.noise===0` после
committed-пар в один из существующих session-смоков (например, расширить
`smoke_lattice_write_barrier.mjs` реальными жестами через инструменты, а не
прямой инъекцией в `_serverCfg`), либо явно задокументировать в ТЗ/хендоффе,
что AC4 закрывается композицией AC1+AC5, и получить с этим согласие
ревьюера. Второй путь дешевле и, на мой взгляд, содержательно корректен —
но должен быть **сказан**, а не подразумеваться.

### M2 (Medium, в скоупе) — `docs/USER-GUIDE.ru.md` не обновлён

Спецификация (§13 «Ожидаемые файлы») называет оба файла:
`docs/USER-GUIDE.md` **и** `docs/USER-GUIDE.ru.md`. В диффе изменён только
`docs/USER-GUIDE.md` (добавлен абзац о невидимом floating-point хвосте,
отчёте Optimize и автоматической защите обычных правок) —
`git diff origin/dev...HEAD --stat -- docs/USER-GUIDE.ru.md` пуст.

RU-версия при этом не «пусто молчит»: раздел 19 уже содержит
общее описание похожего механизма (устранение «невидимого вычислительного
шума» при обычном сохранении, разделение строк «обновлено» и «шум устранён»
в превью), — но это описание существовало **до** #291 (`git blame`:
2026-08-20/23, до ветки задачи) и не называет ни нового per-space разбиения
(`gs.optimize_lattice_space`), ни физического максимума с тремя значащими
цифрами (`formatLatticeShiftCm`) — то, что EN-версия получила явно.

Это нарушает не абстрактное «обе версии», а конкретное правило:
AGENTS.md — «interface wording comes from `docs/USER-GUIDE.ru.md`… or the UI
starts speaking developer»; PROCESS §2.6 — документация в том же коммите,
что поведение; коммит помечен `User-Visible: yes` и уже поправил оба
CHANGELOG (RU+EN) — тот же стандарт должен быть применён и к самому
руководству пользователя.

**Воспроизведение:** `git diff origin/dev...HEAD --stat -- docs/USER-GUIDE.ru.md`
→ пустой вывод; сравнить с непустым для `docs/USER-GUIDE.md`.

**Правка:** перенести/адаптировать на русский абзац, добавленный в
`docs/USER-GUIDE.md` (раздел 19), с упоминанием per-space строк и
физического максимума — по терминологии `gs.optimize_lattice_summary`/
`gs.optimize_lattice_space` из `src/i18n/ru.json`.

### Low — не блокируют, зафиксированы без правки

- **L1.** Хендофф-комментарий автора цитирует run 32732620838 как «зелёный»
  для backend-job, не упоминая, что сам прогон `cancelled` и два job упали
  (`docs`, `process-gate`) — разобрано выше в «CI на ветке», причины не
  относятся к #291 и с тех пор устранены. Отмечаю как точность цитирования,
  не как дефект реализации.

## Что проверено и корректно

- Формула `maxShiftCm = shift * LATTICE_GRID_N * cellCm` в
  `coordinate-canonicalization.ts` **не баг**: она буквально повторяет
  уже существующую конвенцию `align-grid.ts:185` (`d * GRID_N * cellCm`) —
  нормализованные координаты записаны в долях полной ширины плана
  (`NORM_W`/`GRID_N=240` шагов на ширину), поэтому перевод в см требует
  именно этого множителя. Проверил перекрёстно чтением обоих файлов.
- «Одно число — один источник»: `formatLatticeShiftCm(r.latticeMaxShiftCm)`
  в диалоге Optimize (`houseplan-card.ts:16405-16416`) взят из того же
  `OptimizeReport`, что и `Confirm`, и **не** смешивается с
  `d.cm`/`gs.align_count` (обычный grid-align) — разные ключи, разные
  строки, разные источники данных (`lattice.maxShiftCm` vs
  `alignReport.maxShiftCm`), явно разведены и в коде, и в документации
  (`CANVAS.md`: «kept separate from visible `moved/maxShift*`»).
  Единственное смешение — суммарный счётчик в toast `gs.align_done`
  (`m: ... + d.report.latticeCoordinatesCanonicalized + ...`), но это
  легитимная сумма разнородных счётчиков для одной итоговой фразы, а не
  повторное отображение одной и той же величины.
- Порядок операций в `optimizePlans()`: `latticeCanonicalizationReport()`
  считается **до** `canonicalizeConfigGeometryInPlace`/
  `canonicalizeLayoutGeometryInPlace`, которые в свою очередь идут **до**
  `alignAllToGrid` — отчёт не искажён последующей мутацией, а align не
  задваивает то, что уже поправил барьер (числами подтверждено в тесте
  «Optimize canonicalizes the six-room ULP source…»: `coordsCanonicalized===0`
  рядом с `latticeCoordinatesCanonicalized>0`).
- `changed` (готовность к записи) считается по финальному
  `persistedConfig` **после** lattice-канонизации — поэтому
  `latticeCoordinatesCanonicalized>0` всегда подтверждает `changed=true`,
  без риска репортить ненулевые счётчики при `changed=false` (читал код,
  логической рассинхронизации не нашёл).
- Backend-зеркало (`coordinate_canonicalization.py`): `math.floor(scaled +
  0.5)` корректно воспроизводит tie-breaking JS `Math.round` (к
  +∞, включая отрицательные `.5`) — проверено на нескольких контрольных
  значениях вручную (-0.5→0, -1.5→-1, -2.5→-2, совпадает с JS). `store.py`
  не тронут диффом вообще: расширение поведения происходит через уже
  существующий единый вызов `canonicalize_config_geometry`/
  `canonicalize_layout_geometry` внутри `async_save_config_state`/
  `async_save_layout_state` (оба — из #224), что и есть корректный способ
  расширить барьер без создания второй точки входа.
- Гвард `scripts/coordinate-write-barrier-guard.mjs`: пересчитал руками все
  4 frontend-паттерна (`config/set` ×1, `layout/update` ×2, `localStorage.
  setItem(LS_KEY` ×1) прямым `grep` по `src/houseplan-card.ts` — счётчики
  гварда совпадают с реальным числом occurrences.
- i18n: оба новых ключа (`gs.optimize_lattice_summary`,
  `gs.optimize_lattice_space`) присутствуют в `en.json`/`ru.json` буквально
  как в §7.1 ТЗ; `test/i18n.test.mjs` проверяет и текст, и точки вызова в
  `houseplan-card.ts`.
- Трейлеры: все 10 коммитов несут `Issue: #291` и корректный
  `User-Visible: yes|no`; единственный `User-Visible: yes` коммит
  (`9a42c856`) правит оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в
  одном коммите.
- `node scripts/process-gate.mjs --github-range --issues`, прогнан локально
  на HEAD: «гейт пройден, предупреждений 0».
- Документация подсистемы (`CANVAS.md`, `CONFIG-COMPATIBILITY.md`,
  `ARCHITECTURE.md`, `TESTING.md`) содержательно и точно описывает новую
  границу, терминологию не изобретает, ссылается на реальные имена полей
  отчёта.

## Чего не проверял и почему

- **Backend pytest** (`tests_backend/test_coordinate_canonicalization.py`,
  включая мутанты `python-lattice-round-truncates`,
  `optimize-*-storage-half-raw`): в среде ревью не установлен
  `homeassistant` (`ModuleNotFoundError`, даже с `pytest` доустановленным) —
  известное и задокументированное ограничение (AGENTS.md: «A full Home
  Assistant harness cannot run on native Windows… locally only the pure
  subset runs»; здесь и чистый subset не собрался, так как модуль
  `virtual_lights` тянет `homeassistant.components.frontend` уже на
  импорте). Заменил чтением: TS/Python реализации построчно
  идентичны по структуре, тест-файл 1:1 зеркалит TS-тест по значениям
  (те же 4801 узлов, те же граничные случаи), а автор сослался на зелёный
  `backend` job в CI (run 32732620838, JSON подтверждён мной через `gh run
  view`) — «проверено чтением, не исполнением» для backend-части AC1/AC2/
  AC5/AC8/AC10.
- **`npm run golden:verify`**: не прогонял. Diff потенциально меняет
  видимый Optimize-диалог (новые строки отчёта), но
  `test('модели проекта не несут шума решётки (#282)')` (зелёный, в
  `npm test`) доказывает, что все demo-фикстуры, включая
  `golden-geometry`, не содержат lattice-шума — значит новые строки
  (`${r.latticeCoordinatesCanonicalized ? html\`...\` : nothing}`) в
  golden-сценариях `optimize-preflight-dialog-*` не отрenders, и визуального
  расхождения не должно быть. Не стал тратить на это предрелизный гейт;
  если ошибаюсь — `golden:verify` перед бетой это покажет.
- **Полный набор из 182 браузерных смоков**: не прогонял, кроме выбранных
  6 (2 по AC + 4 по smoke-select) — по правилу §8 «полные наборы — гейт
  предрелиза, не код-ревью».
- **Полный HA-харнесс / WSL**: недоступен в среде ревью.
- Не проверял детально совместимость с #290 (уступ 316×1) и #288/#289 —
  их регрессионные тесты в `npm test` прошли без изменений в диффе, а сам
  диф их не трогает; это не отдельная точка риска этой задачи.

## Итог

High-находок нет. Две находки Medium, обе в скоупе задачи (обе — про
собственные акцептанс-критерии/список файлов ТЗ, не сторонний код) и обе
чинятся в этой же задаче без нового issue: M1 (нет production-smoke
для буквы AC4 либо явного признания замены на структурное доказательство)
и M2 (`docs/USER-GUIDE.ru.md` не обновлён при `User-Visible: yes`).
Ядро реализации — сама канонизация, барьер записи, backend-зеркало,
идемпотентность, защита от обхода, производительность — проверено и
работает, включая независимое исполнение на реальных (privacy-minimized)
данных из issue.

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 2 → в задаче**
