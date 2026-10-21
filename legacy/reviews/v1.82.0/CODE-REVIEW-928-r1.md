# CODE-REVIEW — issue #928, заход r1

Материал: `git diff origin/dev...HEAD`, HEAD = `90b391316c3e71c5aff4e944facd9ed93292b443`
(проверено `git rev-parse HEAD` в рабочей копии). Трек `ask`, этап `code`, заход r1,
блокирующих циклов израсходовано 0 из 4. Побочные находки: `mode=issues` (доверенный
снимок `REVIEW_FINDINGS_POLICY`); High/Medium в скоупе не найдены, маршрутизация
для внешних находок не задействована.

## Скоуп

Редактор Плана выбирает начальный инструмент по состоянию текущего пространства:
`select`, если есть хотя бы одна из шести геометрических коллекций (`rooms`,
`wall_segments`, `partitions`, `wall_columns`, `stairs`, `openings` текущего
пространства), иначе `draw`. Решение принимается только при обычном успешном
переходе в Plan из другого режима (`src/houseplan-editor-runtime.ts` → `_setMode`);
onboarding/copy и warm-восстановление сохраняют собственный путь. Побочно
исправлена реальная регрессия, найденная полным CI на промежуточном SHA: при
default-Select на legacy-конфиге с дублирующимся ID стены построение ручек узла
падало до того, как пользователь мог переключить инструмент — `wall-node-editor.ts`
теперь гасит только известный `WallSegmentModelError` при чтении топологии,
не трогая запись.

Изменённые файлы класса A: `src/plan-entry-tool.ts` (новый), `src/houseplan-editor-runtime.ts`,
`src/wall-node-editor.ts`. Класс B: `test/plan-entry-tool.test.mjs`,
`test/wall-node-editor.test.mjs`, `demo/smoke_plan_entry_tool.mjs` (новый),
`demo/smoke_modes.mjs`, `demo/smoke_node_history_context.mjs`,
`demo/smoke_wall_node_topology.mjs`, `scripts/mutation-registry.mjs`,
`scripts/smoke-links.mjs`. Класс C: `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`,
`docs/CHANGELOG.ru.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/USER-GUIDE.ru.md`,
`docs/UX-MODES.md`, `docs/release-ledger/v1.81.0/928.json`,
`docs/testing-notes/mutation-browser-guards.md`. Класс D: 10 PNG в
`demo/golden/baselines/` + `baselines-index.json`.

## Как проверялось

ТЗ принято `SPEC-REVIEW-928-r1` (зелёный, High 0 / Medium 0); его тело в issue не
менялось после приёмки (сверено по телу issue, выданному REVIEW_CONTEXT). Этот код-ревью —
первый реальный вызов модели на S7 для #928: два предыдущих применения метки отказали
механической подготовкой («mechanical preflight»), модель не вызывалась, цикл не
расходовался — согласуется с «заход r1 · 0/4» в шапке задачи.

Прочитан полный дифф (`git diff origin/dev...HEAD`), оба продуктовых файла построчно,
соседние определения (`_spaceModel`, `spaceModels`, `_renderCfg`, `_curSpaceCfg`,
`resumeWarmMode`, `WallSegmentModelError`) — чтобы проверить утверждения ТЗ п.1
(«проёмы берутся из конфигурации текущего пространства, не из отфильтрованного
видимого рендера») и п.3 (warm/resume сохраняет инструмент) по коду, а не на слово.
Прочитаны все новые/изменённые тесты и смоуки, `scripts/mutation-registry.mjs`
(проверено, что оба новых `find`-якоря существуют в файле ровно один раз —
`grep -c` вернул 1 для обоих), `docs/testing-notes/mutation-browser-guards.md`
(арифметика счётчиков 201→203 / 392→394 сходится с двумя новыми записями).

### Таблица гейтов

| Гейт | Статус | Как подтверждён |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | Не перегонялся повторно | Зелёный Validate на точном SHA материала: `gh run view 39054231290` → `headSha=90b391316c3e71c5aff4e944facd9ed93292b443`, `conclusion=success` (§8, дешёвые гейты подтверждены) |
| Полный Validate (все три browser-шарда, golden, performance) | Подтверждён независимо, не переисполнялся | Автор сослался на run `39054229376`; проверено `gh run view 39054229376 --json jobs`: фронтенд/юниты/мутанты-дифф-check, golden, все 3 browser-шарда, perf-смок — все `success`; геометрия TS/Python parity и pytest `tests_backend` — `skipped` (Python не менялся, корректно) |
| `node scripts/smoke-select.mjs` (117 строк) | Выполнен в составе полного Validate выше | Решение по каждой строке — в финальном хендоффе автора, перепроверено составом browser-шардов в `39054229376` |
| `npm run invariants -- --config test/fixtures/834-node-connected.json` | Не перегонялся | Назван автором с результатом PASS на этапе resume950; геометрический дифф read-only, не меняет модель — риск низкий, гейт не повторялся |
| `pytest tests_backend` | Не нужен | Python/интеграция не затронуты диффом |
| `golden:verify` (`ci:golden` на задаче) | Подтверждён | `baselines-index.json`: `localAttestation: null`, `ci.run: 39040447294`, `ci.sha: 1e3a5073…`; `gh run view 39040447294` подтверждает этот SHA и что job «Golden-кадры» в том прогоне закончился `failure` (10 ожидаемых diff) — именно материал, из которого штатно принимались кадры через `golden:accept --reviewed`, не самодельный; в финальном Validate на материале (`39054229376`) Golden-джоб уже `success` |

Почему не перегонял дешёвые гейты и полный Validate заново: они зелёные на
точном SHA ревью, сверено `headSha` через GitHub API, а не только по ссылке в
комментарии — это закрывает требование §8 «зелёный Validate на SHA материала
подтверждает дешёвые гейты» без слепого доверия self-report автора.

## AC → доказательство / отрицательный свидетель (перепроверено)

| AC | Чем доказан | Чем краснеет | Вердикт ревью |
|---|---|---|---|
| AC1 (готовая геометрия → Select) | `test/plan-entry-tool.test.mjs` — отдельный кейс на каждую из 6 коллекций (включая `{cm:0}` — нулевая толщина не делает план пустым) + `smoke_plan_entry_tool.mjs` (wall/column/opening → select, первый клик не пишет `config/layout`, `_path` не растёт) | Обычный отрицательный вход (пустая коллекция → `draw`) исполняется в самом unit-тесте; `plan-entry-ignores-existing-geometry` зарегистрирован, не исполнялся (политика #709 соблюдена) | Подтверждено чтением и исполнением; `openings` сознательно берутся из `_serverCfg`, а не из `SpaceModel` — проверено чтением `spaceModels()` (`src/space-geometry.ts:137-190`): тип `SpaceModel` вообще не несёт поле `openings`, поэтому иного источника и не может быть — объясняет асимметрию в `_setMode` |
| AC2 (пустота/другой этаж → Walls) | Unit: отсутствующие/пустые коллекции, `bg`/`decor`/`devices`/`led_strips`, другое пространство — все дают `draw`; smoke: empty/image-этаж → Walls, один черновой узел без записи | Ordinary negative cases в самом unit-тесте (неизменённая реализация) | Подтверждено |
| AC3 (жизненный цикл, warm, copy) | Native клик по активной вкладке не сбрасывает ручной `draw`; реальный выход/вход пересчитывает в `select`; warm remount и **delayed-permission** warm remount сохраняют ручной `draw`; `devices`/`decor` не затронуты | `plan-entry-replaces-delayed-warm-tool` зарегистрирован, не исполнялся | Подтверждено чтением `resumeWarmMode`/`warm-mode-adoption.ts:53-70`: `tool` захватывается ДО `_setMode`, затем принудительно восстанавливается для `mode==='plan'` — сессия, а не обычный вход, в точности по ТЗ п.3 |
| Защитный гард: legacy duplicate wall ID не роняет default Select | `test/wall-node-editor.test.mjs` — два новых исполненных юнита: (1) дубликат ID → `render()===nothing`, 0 записей/мутаций/capture, `commitWallSegmentModel` на том же конфиге реально бросает `WallSegmentModelError('duplicate-id', …)`, восстановление на валидном снэпшоте; (2) неизвестная ошибка (`TypeError`) явно НЕ проглатывается, `render()` рвётся наружу | Оба случая — исполненные ordinary-тесты на неизменённой реализации (не мутанты); третий столбец не пуст | Подтверждено чтением и исполнением (CI job «Фронтенд: типы, юниты, мутанты» = success в `39054229376`) |

Этот защитный гард не назван отдельным AC в ТЗ, но прямо требуется её контрактом
п.1 («опираемся на уже загруженную модель; не исправляем повреждённые данные») и
стал необходим именно из-за смены дефолта на Select: раньше вход начинался с
Draw и путь построения ручек узла не исполнялся на входе. Регрессия была поймана
реальным полным CI на промежуточном SHA (не придумана постфактум) и исправлена в
том же issue — это в скоупе задачи, а не расширение контракта.

## Риск по изменённым участкам (#707) — geometry: `wall-node-editor.ts`

Все перечисленные строки (66, 89, 94, 97, 98 и ещё 8 ниже по файлу — 139, 281, 290,
296, 302, 304 плюс объявление типа `NodeTopology`) относятся к одному связному
изменению: кэш `{ space, identity, nodes, source }` заменён на
`{ space, identity, data: NodeTopology | null }`, чтобы можно было кэшировать
«безопасных ручек нет» без порчи остальной сигнатуры. Класс риска — geometry,
но правка read-only: не меняет `commitWallSegmentModel`, не меняет запись,
не трогает preflight. Покрытие AC:
- Контракт ТЗ п.1 («не исправляем повреждённые данные», «опираемся на уже
  загруженную модель») — покрывает требование не чинить и не валидировать заранее.
- Явного AC на «не падать при чтении» нет, но поведение прямо продиктовано этим
  же изменением (дефолт Select на существующей геометрии) и доказано исполняемым
  тестом (таблица выше) — не считаю находкой, т.к. есть и названный тест, и
  названный краснеющий случай (duplicate-id бросает `WallSegmentModelError`
  в том же тесте), требование §2.7 «пустой третий столбец — Medium» не применимо.
- `smoke_wall_node_topology.mjs` обновлён только в двух местах чтения приватного
  кэша (`cache.nodes.length` → `cache.data.nodes.length`), сценарии и assert'ы
  не менялись — это обновление наблюдения за приватной структурой, а не ослабление
  оракула; подтверждено исполнением в `39054229376` (browser-шарды success).

## Трейлеры и one-source-of-truth

Все 4 коммита несут `Issue: #928`; `User-Visible: yes` у `c1cf7137` и `1b98a613` —
оба правят `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` в том же коммите (проверено
`git show --stat`). Коммит с golden-кадрами (`5b6d7664`) несёт `Release:` и
`Baseline-Reviewed: <run URL>` — проверено, что `run 39040447294` существует и
действительно соответствует указанному SHA `1e3a5073`.

Величина, видимая пользователю дважды: формулировка фичи в `docs/CHANGELOG.md`,
`docs/CHANGELOG.ru.md`, `docs/USER-GUIDE.ru.md` и `docs/UX-MODES.md` — один
источник намерения (ТЗ п.1/п.4), текст не противоречит и не дублирует число
(тут нет количественных констант — только критерий «есть геометрия/нет»). Ledger
`docs/release-ledger/v1.81.0/928.json` классифицирует `stable-fix` относительно
предыдущего stable `v1.81.0` (текущий package.json — `1.82.0-beta.1`, что
подтверждает выбор базы и совпадает с авторским «milestone 1.82»); авторское
суждение обосновано («полировка поведения, существовавшего в stable 1.81.0»),
не вывод из `User-Visible`.

## Что проверено и корректно

- `planEntryTool` — чистая функция, без геометрических записей; её сигнатура и
  вызов корректно разделяют источник `rooms/wall_segments/partitions/wall_columns/stairs`
  (из `_spaceModel()`) и `openings` (из `_serverCfg`, так как тип `SpaceModel` в
  принципе не несёт это поле) — не баг, а необходимость, продиктованная типами.
- `_setMode` вызывает `planEntryTool` только в ветке `mode === 'plan'`, после всех
  существующих guard'ов (kiosk, markup-needs-server, draft-navigation, danger-confirm,
  wall-chain-finish) — новый код не может обойти ни один из них, т.к. вставлен уже
  после них по потоку выполнения.
- Warm/resume-путь (`resumeWarmMode`) и явные onboarding/copy-пути
  (`space-copy-runtime.ts` ставит `_tool='draw'` уже ПОСЛЕ `setMode('plan')`)
  не задействуют `planEntryTool` — подтверждено чтением обоих файлов.
- Защитный гард в `wall-node-editor.ts` ловит только `WallSegmentModelError`,
  рвёт наружу любую другую ошибку — подтверждено отдельным тестом.
- Все 6 классов геометрии из ТЗ п.1 покрыты и названы явно в unit-тесте и в smoke
  (room/wall_segments/partitions/wall_columns/stairs через параметризованный unit,
  opening — отдельным независимым тестом, wall/column/opening — в native smoke).
- Документация (UX-MODES, USER-GUIDE.ru, ARCHITECTURE, DEVELOPMENT, STATUS) и оба
  changelog обновлены согласованно и терминологией из USER-GUIDE («Выбрать»/«Стены»).
- Полный Validate на точном SHA материала подтверждён независимо через GitHub API
  (`headSha` сверен), а не принят на слово из хендоффа автора.

## Находки

Нет. High: 0, Medium: 0.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`/`npm test`/`npm run build`/`golden:verify`/
  browser-смоки локально — они зелёные на точном SHA материала в независимо
  подтверждённом Validate-прогоне (`39054229376`/`39054231290`, `headSha` сверен
  через `gh run view`), повторный прогон ничего нового не докажет и был бы
  избыточным гейтом не по размеру задачи (§8).
- Не перегонял `npm run invariants` — геометрический дифф read-only (не меняет
  модель), автор назвал команду и результат PASS; доверяю при том, что код
  подтверждает отсутствие изменений в write-path.
- Не исполнял мутанты (ни changed-static, ни ночные) — вне скоупа ревью на
  любом треке/этапе развития (#709); оба новых browser witness правильно
  зарегистрированы, не исполнялись, что и требуется.
- Не проверял руками (GPU/desktop) визуальный результат golden-кадров — они
  приняты штатным `golden:accept --reviewed` из CI-артефакта, ручная приёмка
  добровольна по #929.
- Не проверял touch-редактор отдельно — ТЗ и риски прямо называют его
  best-effort без новых ограничений/обещаний, изменений в touch-путях в диффе нет.
- Не проверял backend/Python — дифф его не касается.

## Маршрут

`mode=issues` (доверенный снимок policy). Находок High/Medium нет — внешний
issue не заводится, побочных находок нет.

Вердикт: зелёный.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/928-plan-editor-default-tool`, коммит `90b391316c3e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8e151bbd8b8ac4a400149323923c5d436b21cc35`
  ```
  git log --all --format='%H %T' | grep 8e151bbd8b8a
  ```
- Тело issue: `a6e368ecaa8445c8feba062268fa6d870673d3f59e4ef3a9f32ff3504b58aa50`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5MzIsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDE3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5Miwib3V0cHV0X3Rva2VucyI6MzE5NzYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTI2ODM2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDc4NTA1NiwiY29zdFVzZEVzdGltYXRlIjoxLjc4NDI5OTJ9XSwidHVybnMiOjU1LCJkdXJhdGlvbk1zIjozOTQ1MTksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjc4OTMxNjIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5024 output_tokens=31993 cache_creation_input_tokens=126836 cache_read_input_tokens=4785056 num_turns=55 -->
