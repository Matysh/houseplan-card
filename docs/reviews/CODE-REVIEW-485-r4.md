# CODE-REVIEW-485-r4

Issue: [#485](https://github.com/Matysh/houseplan-card/issues/485) — presence-radar
Stage 1. Этап: code (PROCESS.md §2.7). Заход r4, блокирующих циклов израсходовано
3 из 4 до этого раунда (r1 — красный, High 6/Medium 6; r2 — жёлтый, High 0/Medium 3;
r3 — жёлтый, High 0/Medium 1).

Материал: ветка `issue/485-radar-presence`, `git log --oneline origin/dev..HEAD` /
`git diff origin/dev...HEAD`, HEAD = `ca25e910876067a067b303497022d6a9a988b39f`
("test: keep radar bundle ratchet outside gzip noise") — рабочая копия уже на этом
SHA, `git fetch`/`checkout` не выполнялись.

## Почему разбор полный, а не по дельте (PROCESS §2.10)

Вердикт r3 (комментарий issue, `2026-09-09T00:32:39Z`) называет HEAD `f474793d`.
Этот SHA мёртв в текущей истории: `git cat-file -t f474793d9b5f...` →
`fatal: could not get object info`. Проверка показала тот же паттерн, что r3 уже
описала для перехода r2→r3:

- committer-время всей цепочки коммитов ветки, от `78afb689` (спецификация) до
  `ca25e910` (правки этого раунда), сбито в узкий интервал `03:50:50–04:01:00 +0300`
  09.09 — сквозная переигровка ветки, а не точечный `amend`;
- `git merge-base origin/dev HEAD` = `3434747d` ("build: prepare v1.73.0-beta.7
  candidate") — это САМ ТЕКУЩИЙ tip `origin/dev`. Прежний merge-base на момент r3
  был `687056f3`, и `687056f3` — предок `3434747d` (`git merge-base --is-ancestor`
  подтверждает), то есть между r3 и этим раундом `dev` продвинулся ещё дальше:
  влился #493 (`13a0bfdf`/`578cae52`/`260435e4`) и был вырезан кандидат
  `v1.73.0-beta.7` (`3434747d`);
- пересечение путей `git diff --name-only 687056f3..3434747d` с путями ветки
  радара (`git diff --name-only origin/dev...HEAD`) непустое и включает продуктовый
  код, не только бандл/доки: `custom_components/houseplan/websocket_api.py`,
  `custom_components/houseplan/validation.py`, `src/houseplan-card.ts`,
  `src/houseplan-editor-runtime.ts`, `tests_backend/test_ha_websocket.py`.

Это прямо названный в процессе триггер («ребейз на ушедший вперёд dev — после
ребейза это другой код»), причём `websocket_api.py` — тот самый файл находки M-2
из r2/r3. Поэтому ниже — полный повторный разбор пересечённых файлов плюс
построчная перепроверка присутствия всех прежних находок, а не только диффа по
единственной находке r3.

## Как проверялось

Прочитан весь diff `origin/dev...HEAD` (см. состав ниже) и построчно —
пересечение путей ребейза с веткой радара, и оба новых коммита раунда:
`3f0b4aee` ("test: cover radar radial calibration guard" — закрывает M-1 из r3)
и `ca25e910` ("test: keep radar bundle ratchet outside gzip noise" — калибровка
`bundle:budget` после ребейза на #493 + пересборка бандла/отпечатка скриншотов).

**Пересечение путей ребейза с веткой радара проверено построчно, конфликтов
смысла нет:**
- `custom_components/houseplan/websocket_api.py:1459` — фикс M-2 из r2/r3
  (`**({"radar_stage1_api": 1} if rt.radar_coordinator is not None else {})`)
  на месте, не затронут посторонними правками #493 в этом же файле.
- `custom_components/houseplan/validation.py` — упоминания `radar` (`vol.Optional
  ("radar")`, строки 1818-1820, 2183) не изменились по смыслу; правки #493 в
  этом файле относятся к summary-panel, не пересекаются построчно.
- `src/houseplan-editor-runtime.ts` — `radarAfterBindingChange` (фикс H6 r1) и
  оба места вызова (13015, 13071 в r3; строки сместились из-за вставки
  summary-panel-кода, но логика та же — `...radarAfterBindingChange(d.radar,
  d.radarTouched, d.radarRemove)`) не тронуты.
- `src/houseplan-card.ts` — синхронное закрытие диалога маркера (фикс `d433b64c`
  из r2, регрессия общего пути) на месте: `_closeMarkerDialog()` в
  `houseplan-editor-runtime.ts:7331-7335` по-прежнему разветвляется на
  `isDirty()`, синхронный путь не стал асинхронным повторно.
- `tests_backend/test_ha_websocket.py` — тест M-2
  (`test_config_get_advertises_radar_only_while_coordinator_is_ready`,
  строки 40-58) присутствует, не переписан слиянием с #493-тестами
  (`test_summary_panel.py` — отдельный файл, не тот же диапазон строк).

**Прогнанные гейты:**

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный |
| `node --test test/*.test.mjs` (полный фронтенд-набор) | 2378 passed, 1 skipped, 0 failed (2379 всего, `npm test`) |
| `npm run build` | собрано (rollup, 19.1s) |
| `npm run bundle:sync` | `dist` → `custom_components/houseplan/frontend` → `demo/srv/assets`; `git status` чист и до, и после — бандл воспроизводим побайтно |
| `npm run bundle:budget` | 0 — initial View 298 523 Б gzip / потолок 299 100 (±2000), запас до потолка 577 Б, до бюджета 301 066 Б — 2543 Б (предупреждение о малом запасе — унаследованный долг #367→#474, не новый) |
| `node scripts/check-docs.mjs` | «Documentation checks passed» — отпечаток скриншотов актуален после пересборки в `ca25e910` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 60 прямых совпадений + 1 зарегистрированная связь — та же картина, что в r3 (артефакт полного диффа branch-vs-dev, не нового кода раунда: см. обоснование ниже) |
| `node demo/smoke_radar_setup.mjs` | OK, все поля отчёта `true` |
| `node demo/smoke_radar_live.mjs` | OK, все поля отчёта `true` |
| `python3 -m pytest tests_backend/test_radar_geometry.py tests_backend/test_radar_validation.py -q` (системный Python 3.12 + `pip install pytest voluptuous`) | 57 passed (14 geometry + 43 validation — на один больше r3: новый тест M-1) |
| Ручная мутация нового гварда-теста M-1 (backend): `radial_ok and rms<=20…` → `rms<=20…` в `radar_geometry.py:199` | новый тест `test_two_point_fit_rejects_hidden_radial_mismatch` красный (`DID NOT RAISE`); откат подтверждён (`git diff --stat` чист) |
| Ручная мутация того же гварда (TS): `radialOk && rmsCm<=20…` → `rmsCm<=20…` в `radar-geometry.ts:79`, пересборка `test-build` (`tsc -p tsconfig.test.json && fix-test-build.mjs`) | новый тест «rejects a reference with a hidden radial mismatch» красный (1 fail из 7); откат подтверждён |
| `git diff --name-only 687056f3..3434747d` ∩ `git diff --name-only origin/dev...HEAD` | непустое пересечение, разобрано построчно выше — не находка, конфликтов смысла нет |
| Merge-conflict маркеры (`<<<<<<<`/`=======`/`>>>>>>>`) по всему дереву | не найдены |
| Трейлеры новых коммитов раунда (`git show -s --format=full`) | `3f0b4aee`/`ca25e910` — `Issue: #485`, `User-Visible: no` на обоих (тест-фикс и внутренняя калибровка бюджета — без видимого пользователю поведения, changelog не требуется) |
| `npm run invariants` | не запускался — diff не трогает рёбра комнат/толщину/`layout`/`marker.space`/`open_spans` (`grep` по всем изменённым backend/frontend/тестовым файлам раунда и по пересечению с ребейзом — 0 совпадений) |
| CI Validate на точном SHA `ca25e910` (`34297455739`) | **«Бэкенд: pytest в Home Assistant» — completed/success, 823 passed, 2 skipped** (полный HA-харнесс, включая `test_ha_radar*.py`/`test_ha_websocket.py`); «Фронтенд: типы, юниты, мутанты, синхрон бандла» — success; HACS/hassfest/preflight — success; «Мутанты по диффу» (3 job) — **ещё in_progress** на момент публикации; смоки/perf/golden — `skipped` (heavy-гейт не по расписанию для обычного пуша, ожидаемо) |

Зелёного полного Validate на этом SHA пока нет (мутационные job не завершены) —
как и предупреждает задание, гейты выше прогнаны самостоятельно. В отличие от
r3, здесь уже есть завершённый **успешный** прогон job «Бэкенд: pytest в Home
Assistant» на точном SHA — это закрывает главный пробел r3 («Чего не
проверял»: HA-харнесс недоступен в песочнице ревью) фактическим результатом, а
не предположением автора.

## Находки

### High — нет

### Medium — нет

Единственная Medium-находка r3 (M-1: четвёртый гвард решателя `radial_ok`/
`radialOk` не покрыт тестом) закрыта предметно — см. таблицу ниже.

### Low (унаследовано, не растёт)

- Нет golden-сцены для радара (`find demo/golden -iname "*radar*"` — по-прежнему
  пусто). Не эскалирую третий раунд подряд по той же логике r2/r3: защитные
  утверждения (частичное здоровье, отрисовка зон, гейт допустимости калибровки,
  отказ неподдерживаемых команд) уже доказаны прицельными негативными тестами.
- Планка 4 кадра/с общая на координатор, а не «на радар» буквально
  (`radar.py:236-256`, поля `_pending`/`_last_publish_monotonic` — координатора).
  Не новый риск, не изменился в этом раунде.

## Закрытие раунда r3

| Находка r3 | Чем закрыта | Где видно |
|---|---|---|
| M-1 — четвёртый числовой гвард решателя (`radial_ok`/`radialOk`, согласованность радиальной дистанции) не покрыт ни одним тестом ни в backend, ни в TS-двойнике | `tests_backend/test_radar_geometry.py::test_two_point_fit_rejects_hidden_radial_mismatch` (коммит `3f0b4aee`) — референс с верным направлением, но радиальной ошибкой 25 см (RMS 17.68/индив. ошибка 25,0 — оба проходят), требует `ValueError(invalid_selection)`; симметричный тест «rejects a reference with a hidden radial mismatch» в `test/radar-geometry.test.mjs` | Подтверждено ручной мутацией на обеих сторонах в этом раунде (таблица гейтов выше): снятие `radial_ok`/`radialOk` из условия красит ровно эти новые тесты и ничего больше (`DID NOT RAISE` на backend, `1 fail` из 7 на TS) |

## Унаследовано из r3 (без повторного разбора по существу — только подтверждение присутствия после ребейза)

Документ: `docs/reviews/CODE-REVIEW-485-r3.md`, SHA материала r3 `f474793d9b5f`
(мёртв после ребейза — см. «Почему разбор полный» выше; дерево `33297f22…`).

- **Все 6 High из r1** (partial-health, teardown/await race, LD2450 same-device
  guard, no-contour warning vs refusal, zones render, radar binding-change
  wipe) — подтверждены присутствующими построчным чтением тех же мест кода,
  что называл r3 (`radar.py:552-554`, `radar.py:106-151`,
  `radar_validation.py:147-180`, `radar-render.ts:18-24`,
  `radar-editor.ts:65-75`/`houseplan-editor-runtime.ts` вызовы
  `radarAfterBindingChange`). Ни один из этих файлов не входит в пересечение
  путей ребейза этого раунда (`687056f3..3434747d`), кроме
  `houseplan-editor-runtime.ts` — который перепроверен заново в этом раунде
  (раздел «Как проверялось»), не унаследован вслепую.
- **M-2 (капабилити `radar_stage1_api` условна на `radar_coordinator`)** и
  **M-3 (`radar.bad_references` реально достижим и промаршрутизирован
  отдельно от `radar.bad_fit`)** из r2 — оба файла (`websocket_api.py`,
  `radar-setup.ts`/`radar-geometry.ts`) перепроверены заново в этом раунде
  (не унаследованы вслепую), потому что `websocket_api.py` входит в
  пересечение путей ребейза — см. «Как проверялось».
- **i18n-структура** (`en`/`ru`/`de`/`fr`, 1363/1363 ключей без расхождений) —
  принято без повторного построчного обхода: diff этого раунда не касается
  `src/i18n/*.json`, а полный фронтенд-набор `npm test` (2378/2379, включает
  `test/i18n.test.mjs`/`test/i18n-dead-keys.test.mjs`) прогнан заново и
  зелёный.
- **Права и лимиты** координатора (ACL на подписку/инспекцию, `MAX_RADARS=32`,
  лимиты подписок) — приняты без повторного чтения: `radar.py`/
  `radar_websocket.py` не входят в пересечение путей ребейза этого раунда и
  не менялись диапазоном коммитов `3f0b4aee`/`ca25e910`.
- **`single-source-numbers`** (радар не создаёт вторых источников чисел) —
  принято по тому же аргументу: код рендера/диагностики не менялся, тест
  прогнан заново в составе полного набора и зелёный (3/3 внутри 2378).

## Что проверено сверх таблиц

- **Легитимность повышения потолка `INITIAL_VIEW_GZIP_CEILING`
  (299 000→299 100, коммит `ca25e910`).** Не тихое ослабление гейта:
  фактическая пересборка в этой песочнице дала 298 523 Б — под новым потолком
  на 577 Б, что и обосновывает комментарий коммита («восстановить >500 Б
  запаса шума по обе стороны существующей 2 кБ ratchet-полосы» после того, как
  ребейз на #493 сдвинул gzip-размер до 298 527 Б — почти вплотную к старому
  потолку 299 000). Проверено самостоятельной пересборкой, а не принято на
  слово из текста коммита.
- **Трейлеры и changelog.** `e9fb255a` («fix: close radar review gaps»,
  предок обоих новых коммитов раунда, `User-Visible: yes`) правит оба
  changelog в себе же — подтверждено `git show --stat`. Оба новых коммита
  этого раунда (`3f0b4aee`, `ca25e910`) — `User-Visible: no`, `Issue: #485` —
  корректно: ни один не меняет видимое пользователю поведение.
- **Инварианты геометрии неприменимы**: ни пересечённые с ребейзом файлы, ни
  два новых коммита раунда не касаются рёбер комнат/толщины/`layout`/
  `marker.space`/`open_spans`.

## Чего не проверял

- **Полный `demo/smoke_*.mjs` (234 файла)** — не гонял. `smoke-select` вернул
  60 прямых совпадений, но это артефакт того же полного диффа
  `origin/dev...HEAD`, что видели r2/r3 (символы `_markerDialog`/
  `_editorRuntime`/`_mode`/`_cfgRev`/`cellCm` — из файлов, которые фактический
  дифф этого раунда (`3f0b4aee`/`ca25e910`) не трогает вовсе: они меняют
  только `test/radar-geometry.test.mjs`, `tests_backend/test_radar_geometry.py`,
  бандл-артефакты, `scripts/bundle-budget.mjs` и `docs/images/screenshots.json`).
  Два **прямых** радар-смока (`smoke_radar_setup.mjs`, `smoke_radar_live.mjs`)
  прогнаны и зелёные; остальные 58 — код диалога/навигации, не тронутый этим
  раундом и уже прогнанный прицельно в r2/r3.
- **Мутационный CI-гейт «Мутанты по диффу» (3 job)** — не завершён на момент
  публикации документа (in_progress). Не жду: ручная мутация конкретно тех
  строк, что добавил этот раунд (`radial_ok`/`radialOk`), выполнена лично и
  задокументирована в таблице гейтов — это прямая, а не косвенная замена той
  же роли для нового кода. Если по завершении job «Мутанты по диффу» на этом
  SHA окажется красным на не рассмотренной мной строке — это отменяет вердикт
  независимо от прочтения кода.
- **`python -m pytest tests_backend -q` (полный набор, без HA)** — не гонял
  весь модуль, только `test_radar_geometry.py`+`test_radar_validation.py`
  (57 тестов, прямо относящихся к дельте и к M-1). Полный backend-набор вне
  HA харнесса r3 уже прогоняла целиком (451 passed) на код, который этот
  раунд не меняет за пределами двух перечисленных файлов.
- **`npm run golden:verify`** — не прогонял: diff не трогает рендер; r2/r3 уже
  зафиксировали отсутствие golden-сцен для радара как Low, не растущий третий
  раунд подряд.
- **Perf-профили** — не запускал: diff не касается `iso-*`/`live-*`/
  `render-*`/`houseplan-render-lifecycle.ts`, AC стадии не требуют
  perf-профиль отдельным доказательством.
- **`node scripts/mutation-gate.mjs` локально** — не запускал; см. пункт про
  CI-джобы «Мутанты по диффу» выше — сам гейт ещё выполняется в CI на этом SHA.

## Итог

0 High, 0 Medium. Единственная Medium-находка r3 (четвёртый числовой гвард
`solve_two_point`/`solveRadarTwoPoint` без теста) закрыта точечным тестом на
обеих сторонах, подтверждена ручной мутацией (гвард снят → новый тест красный
на backend и на TS). Ребейз на ушедший дальше `dev` (влился #493, вырезан
кандидат `v1.73.0-beta.7`) потребовал полного, а не дельта-разбора; пересечение
путей с продуктовым кодом (`websocket_api.py`, `houseplan-editor-runtime.ts`,
`houseplan-card.ts` и др.) проверено построчно — конфликтов смысла ребейз не
внёс, все находки r1/r2 на месте. CI Validate на точном SHA уже подтвердил
полный HA-харнес бэкенда (823 passed/2 skipped) — это закрывает главный пробел
предыдущего раунда независимым прогоном, а не заявлением автора. Вердикт —
зелёный.

<!-- material-anchors: заполняется конвейером публикации -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/485-radar-presence`, коммит `ca25e9108760` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ca12394f18186c16362c75919099036c3213a5f2`
  ```
  git log --all --format='%H %T' | grep ca12394f1818
  ```
- ТЗ `docs/specs/485-radar-presence-stage1.md`, блоб `322f040bfcfdba41802caad302da99188ab9d710`
  ```
  git log --all --find-object=322f040bfcfdba41802caad302da99188ab9d710 -- docs/specs/485-radar-presence-stage1.md
  ```
- ТЗ `docs/specs/485-radar-presence-stage2.md`, блоб `b403e73fc26ba0ffb97be4ffa73be067d179880f`
  ```
  git log --all --find-object=b403e73fc26ba0ffb97be4ffa73be067d179880f -- docs/specs/485-radar-presence-stage2.md
  ```
- ТЗ `docs/specs/485-radar-presence-stage3.md`, блоб `c65e28389d762216c47f00249bdb751f3c9d5082`
  ```
  git log --all --find-object=c65e28389d762216c47f00249bdb751f3c9d5082 -- docs/specs/485-radar-presence-stage3.md
  ```
- ТЗ `docs/specs/485-radar-presence.md`, блоб `3297ed0140265ad86f2072a40cb9bf8097c0674d`
  ```
  git log --all --find-object=3297ed0140265ad86f2072a40cb9bf8097c0674d -- docs/specs/485-radar-presence.md
  ```
- Вердикт конвейера: `green` · High 0
