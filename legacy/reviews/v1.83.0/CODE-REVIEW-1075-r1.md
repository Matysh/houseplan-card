# Код-ревью #1075 — заход r1

**Материал:** `4d522136653f02c231588af9ee1454dedaea7f7c` (ребейз канонической ветки на принятый `dev`).
**Трек:** ask · **Этап:** code · **Блокирующих циклов:** 0/4.

## Скоуп

Задача: открыть контекстное меню удаления узла стены при любом инструменте Плана
(не только «Выбрать»), устранить избыточную материализацию чужих этажей и
повторное доказательство кандидата в `wall_node_delete`, переиспользовать
revision-bound junction baseline, и добавить fast-path для decor-only
Undo/Redo (в т.ч. размещения мебели), не рассыпая стеновую/физическую модель.
Изменённые файлы: `custom_components/houseplan/{wall_node_delete.py,websocket_api.py}`,
`src/{decor-history-restore.ts,houseplan-editor-runtime.ts,wall-node-card-adapter.ts,
wall-node-delete-menu.ts,wall-node-editor.ts}`, соответствующие demo/test/tests_backend
и документация/ledger/golden-матрица.

Это пятый code-ревью заход по этой ветке (история из read:log: 4d522136, 8cbcca90,
e6e0ee93, 9c1ccf42, 5efc2515); предыдущий материал был признан блокером по #1082 и
перебазирован на актуальный `dev` без изменения продуктового кода/ТЗ (bodyDigest не
менялся) — трактую это как r1 относительно нового SHA, независимый разбор ниже
выполнен заново по всему диффу, а не унаследован.

## Как проверялось

Static-first: прочитан `read:log`, `read:diff` (полный дифф материала, 1549 строк),
затем точечно — базовые версии `wall_node_delete.py`, `websocket_api.py`,
`wall-node-editor.ts`, `wall-node-card-adapter.ts`, `wall-node-delete-menu.ts`,
`decor-history-restore.ts`, `junction_limits.py`, `wall_segment_model.py`,
`coordinate_canonicalization.py` — прослежены вызывающие пути и инварианты
независимо от авторского объяснения, затем сверено с хендоффом/анализом/ТЗ.

Исполненные проверки runner'а (все на материале `4d522136...`):

| Check | Результат |
|---|---|
| `read:log`, `read:diff` | OK |
| `build:test`, `build:build`, `build:bundle:sync`, `build:typecheck` | PASS |
| `unit:test/decor-history-restore.test.mjs` | PASS |
| `unit:test/wall-node-delete-menu.test.mjs` | PASS |
| `unit:test/wall-node-card-adapter.test.mjs` | PASS |
| `unit:test/wall-node-editor.test.mjs` | PASS |
| `unit:test/wall-node-delete.test.mjs` | PASS |
| `unit:test/wall-node-bundle.test.mjs` | PASS (21462 B gzip == новый бюджет 21462, без запаса) |
| `unit:test/golden-matrix.test.mjs` | PASS (версия 94 согласована с новой сценой) |
| `smoke:demo/smoke_wall_node_delete.mjs` | PASS (после `build:bundle:sync`) |
| `smoke:demo/smoke_editor_command_latency.mjs` | PASS, вывод содержит нулевые структурные билды для `small`/`large-house` сцен |
| `static:bundle-budget`, `static:mutation-registry`, `static:ci-registry-inventory`, `static:status-snapshot` | PASS |

`smoke:demo/smoke_wall_node_delete.mjs` и `unit:test/wall-node-bundle.test.mjs`
при первом запуске падали с `ENOENT`/`Failed to fetch dynamically imported module`
из-за отсутствия собранного `dist/` в чистой рабочей копии ревьюера — это
артефакт окружения ревью (материал не собран заранее), не находка по коду;
после `build:build`/`build:bundle:sync` оба PASS на том же материале.

Не исполнялось (и почему): полный `npm run gate:small`/`npm test`/`ci:golden` —
не является адресной заменой точечной проверки риска (инструкция §8, «Объём
гейтов»); backend pytest (`tests_backend/test_wall_node_delete.py`,
`test_ha_wall_node_delete.py`, `test_ha_editor_command_latency.py`) — в
манифесте проверок `review-execution-policy` нет check_id для исполнения
pytest, доступного oracle для них в этом ревью-окружении нет; эти изменения
разобраны чтением кода и логики новых/изменённых тестов (см. ниже), с явной
пометкой «проверено чтением, не исполнением». Полный Golden-прогон новой сцены
`node-menu-walls-1075` не запускался — сам ledger (`docs/release-ledger/v1.82.0/1075.json`)
и анализ (`docs/analysis/1075-editor-command-latency.md`) явно откладывают её
приёмку до обычного бета-цикла, не предъявляя как доказательство этой задачи;
непротиворечиво с «не гейт задачи» по свежести скриншотов/глобальных эталонов.

## Независимый разбор и сопоставление с доказательствами

**Backend `wall_node_delete.py` (`_current_basis`/`_materialize_space`/`PreparedNodeDelete`).**
Прослежено: для «текущей» модели (model_version совпадает, нет room_drafts/open_spans/open_to,
wall_ids — список) код доказывает один факт — что материализация ИМЕННО целевого
пространства воспроизводит хранимое значение (`_equal(_materialize_space(...), source)`),
и только тогда переиспользует весь документ как baseline без полной
`commit_wall_segment_model` над всем домом; иначе — старый полный путь (legacy
fallback). Проверено, что `_materialize_space`/`canonicalize_config_geometry`
обрабатывают пространства независимо (в `wall_segment_model.py` и
`coordinate_canonicalization.py` цикл идёт `for space in candidate["spaces"]`
без межэтажного состояния, кроме документного `model_version`, который
`_materialize_space` явно передаёт из исходного конфига) — то есть
изолированная материализация одного пространства даёт тот же результат, что
и материализация внутри полного документа; скрытого риска ложного
совпадения не нашёл. `PreparedNodeDelete.host_baseline()` делит один и тот же
`baseline`, не запрашивая его заново — соответствует AC3 (один источник для
candidate и host-proof) и подтверждено backend-тестом
`test_issue_1075_current_target_proof_never_materializes_an_unchanged_other_floor`
(чтением: он считает вызовы `commit_wall_segment_model` и проверяет, что они
видят только `["f"]`, не `["other"]`, причём до и после host-proof список вызовов
не меняется). Малформед «other»-пространство по-прежнему ловится на
`CONFIG_SCHEMA(candidate)` — подтверждено тестом
`test_issue_1075_current_version_does_not_bypass_complete_schema`: быстрый путь
не обходит полную схему.

**Junction baseline (`websocket_api.py`).** `rt.junction_baseline` используется
только при точном совпадении `inherited[0] == rev`, иначе пересчитывается
(`baseline_counts=None`) — подтверждено чтением сигнатуры
`validate_junction_limits(config, previous=None, *, baseline_counts=None)` в
`junction_limits.py` и тестом `test_issue_1075_junction_baseline_has_exact_revision_authority`
(exact/stale/missing параметризация). Публикация кеша (`rt.junction_baseline = (new_rev, counts)`)
стоит ПОСЛЕ `await async_save_config_state(...)`, вне try/except — при падении
сохранения исключение уходит наружу необработанным (как и в соседних
обработчиках того же файла), кеш не публикуется; подтверждено тестом
`test_issue_1075_storage_refusal_never_publishes_junction_cache`. Чтением (pytest
не исполнялся в этом окружении — нет доступного check_id в манифесте этого
ревью) — логика тестов и путь кода совпадают, выводов о скрытом расхождении нет.

**Меню при любом инструменте (`wall-node-editor.ts`, `wall-node-card-adapter.ts`,
`houseplan-editor-runtime.ts`).** `_renderWallNodes()` больше не блокирует
загрузку узлового редактора условием `tool === 'select'` — подсистема
лениво грузится при любом Plan-инструменте (ранее — только Select). В
`WallNodeEditor.down()` правая кнопка проверяется ДО `ctx.enabled`
(select-only контекст перемещения узлов) через отдельный `deleteEnabled()`
(`mode==='plan' && writer() && connection.connected !== false && !blocked()`),
который не зависит от инструмента — это и есть суть фикса. Проверил
потенциальный риск: перемещение проверки `this.busy` ПОСЛЕ право-клик-ветки
могло бы пропустить правый клик во время активного drag/записи — но
фактическое открытие меню идёт через `WallNodeDeleteMenu.open()`, который
независимо делает `if (!ctx.enabled || this.port.busy()) return;`, а
`busy()` порта — `() => this.busy || this.dragging`; так что занятость всё
равно блокирует реальное открытие меню, риска не нашёл.

Отдельно проверил контрактный пункт §5.4 ТЗ («смена инструмента закрывает
старое меню»): реализация не завязывает это на `render()`/`ctx.enabled`
(которые у delete-контекста не зависят от инструмента), а делает это
универсально через `_activateMarkupTool()` → `invalidateEditorNavigation()` →
`this.nodeMove?.cancel()` (`houseplan-editor-runtime.ts:921,1494`), которая
вызывается на КАЖДОЕ переключение инструмента, включая переходы через
групповые меню (`invoke:()=>this._activateMarkupTool(id)`, `:5185`). Также
растёт `_navigationIntent`, который отдельно учитывается в
`WallNodeDeleteMenu.current()`. Правый pointerdown-сценарий и сохранность
инструмента при открытии меню под `draw/column/wall-thickness/window/door/
passage/gate/merge/split/resize/delroom/straight/spiral` проверены новым
нативным разделом `smoke_wall_node_delete.mjs` (исполнен здесь, PASS) — explicit
negative `no_placement_pan_history_or_write` на каждом инструменте.

**Decor-only fast path (`decor-history-restore.ts`, `_applyGeometryState`).**
Guard: модель-версия текущая, нет nodeMove/wallChainSeedIds/roomReferences,
fingerprint «всего кроме decor» совпадает между before/target, все
пространства документа — «текущей» формы. При успехе — только копирование
`decor`, `host._cfgEpoch++` вручную (так как обычный путь инкрементирует эпоху
внутри пропускаемого `_restoreGeometryStateLocal`), `commitWallSegmentModel`/
`adoptWallSegmentModelCandidateInPlace`/`host._maybeRebuildDevices()`
пропускаются. Проверено, что `_restoreGeometryStateLocal` — единственное
место, чистящее `_wallUnionCache`/`_physicalBodiesCache` — в decor-only ветке
не вызывается, что и даёт «ноль новых структурных билдов»; подтверждено
исполнением `smoke_editor_command_latency.mjs` (PASS) — в выводе
`cacheBuilds` для `small`-сцены: `wallUnion:0, physicalBodies:3 (неизменно
по сэмплам), innerContour:0, lightBarrier:0` и т.д. при 6 сэмплах
Undo/Redo + cold reload.

**Golden/бюджет.** `GOLDEN_MATRIX_VERSION` 93→94 согласован с одной новой
сценой `node-menu-walls-1075`; существующие сцены не трогают. Бюджет
Select-only графа поднят 21458→21462 B — подтверждено исполнением: фактический
gzip ровно 21462 B, без запаса, как заявлено автором.

**Release-ledger.** `category: stable-fix` обоснован датой появления
безусловного `commitWallSegmentModel(restoredCandidate)` в `fac660980`
(#883, 2026-10-14, до тега v1.82.0 от 2026-10-21); summary ru/en говорят
только про мебель/декор, доля меню/node-delete явно не включена в
stable-fix summary и свёрнута в #1045 — согласуется с ТЗ §12 и телом issue.
`introducedBy` отсутствует — уместно для категории stable-fix (не новая
бета-фича).

## Что проверено и корректно

- Разделение Select-only capture/handles и доступности меню по любому
  Plan-инструменту, включая холодный вход без визита в Select.
- Правый pointer-жест не двигает камеру/узел и не создаёт объект на всех
  перечисленных инструментах (включая групповые: opening/rooms/stairs).
- Один immutable menu basis проверяется один раз (убран повторный `reason()`
  перед отправкой), подтверждено unit-тестом с явным счётчиком валидаций.
- Backend: current-model forward/inverse не материализует чужие неизменённые
  этажи, legacy-документ сохраняет полную миграцию, полная schema не
  обходится, host baseline переиспользует один источник.
- Junction baseline используется только при точном совпадении ревизии и не
  публикуется при отказе сохранения.
- Decor-only Undo/Redo (включая мебель) не пересобирает стеновые/физические
  кеши; защищённые случаи (физические/смешанные/legacy/chain/room-reference)
  остаются на строгом пути — подтверждено исполнением нового smoke.
- Таблица «AC · чем доказан · чем краснеет» присутствует в
  `docs/analysis/1075-editor-command-latency.md` («Protective evidence») для
  всех защитных контрактов, непустая по каждой строке.
- Trailers/ledger-классификация (stable-fix vs line-fix в #1045) согласованы
  с телом issue и датами.

## Чего не проверял (и почему это приемлемо)

- Backend pytest-наборы (`test_wall_node_delete.py`, `test_ha_wall_node_delete.py`,
  `test_ha_editor_command_latency.py`) не исполнялись мной: в манифесте
  доступных `run_check` id для pytest нет. Логика этих тестов разобрана
  чтением и сопоставлена с кодом обработчика — пометка «проверено чтением,
  не исполнением». Это не заменяет исполняемый oracle, а фиксирует честную
  границу проверки для этого окружения.
- Полный `gate:small`/`ci:golden`/полный golden-прогон новой сцены — не
  запускал: задача явно откладывает приёмку новой сцены до обычного бета-цикла,
  а полный гейт избыточен для точечного риска (адресные unit/smoke выше
  покрывают изменённые модули и дали независимый PASS на этом материале).
- Живой HA/реальная дача — не используется и не должна использоваться для
  ревью; диагностика в `Test Plan`, описанная в ТЗ, была частью авторской
  аналитики, не предмет этого захода.

## Находки

High: 0. Medium (в скоупе): 0. Серьёзных находок не обнаружено.

Побочных находок вне скоупа этой задачи не выявлено.

## Маршрут

`route: fix` (зафиксировано политикой захода, не зависит от вердикта).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjJlNDNhZWY2YTM2ZWMzNTRkM2JkYjhkZGZjM2Q3ZTYwNTY4NzM4NmI5MmEwOWVlZjU0ZGQ0OWIzNzFmNzg2YzYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJjOGE4MGFmYTQ0MzE5OWJmNTExMzk5NmUwYzk4NTdjZTk1ODdjZjQ5MThjZTZjZjBmYTI2NzFmZWEzMmQ0Mjk5IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDc1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI0ZDUyMjEzNjY1M2YwMmMyMzE1ODhhZjllZTE0NTRkZWRhZWE3ZjdjIiwidHJlZSI6IjgxMDE5ZThlZjU4YTBhNmRlMmU1OGMzOTgyYmVjNmUzODYzYjgxOGQiLCJib2R5RGlnZXN0IjoiNzFhODU2MTA2YmQwNjBmNTkxYWQxYTY5ZGIzMjY5NTkwYTEzODYwNGE5ODBjYjNiNzhmZTc2ZmEwNjg0NWVhYiIsInByb2R1Y2VyUnVuIjoiNDAyODYxNTE0ODQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjUzODUwOTFjYTNhYmEwMTZiNDk0OTExMjMzNmVkMmIxNzBjYTllZjY1YjNkNzc4ZmI5ZDQxNDhlYWU4ZDQ2ZDMiLCJ2ZXJkaWN0RGlnZXN0IjoiZDU5OTA0NjFmNjZhYjI4MjY2Nzk0YTZmNmI4OTAyMjRmZGJmMTM5YTZlNjg5NGExMTg4ZDlmZTQ4MjgxMDc3ZSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiNjE1ZDY3YjU4OWNjZWYzNzk3OGE4YjAxMGYyZTdiNzliNTA2NDQzNzk3YWQ2MzEzMWVhZTlhNmMzMzdkNGM1IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDEwODgzMjcxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDc1I2lzc3VlY29tbWVudC02NDEwODgzMjcxIiwiYm9keURpZ2VzdCI6ImIxMmZmNzc4NmYyZTNmMTEwYmFjNjgxZTNiNjMyNWY4ZDVkYWY5MDgyZTZiMTU5NzQyZDQ1MWM2YTgxNTA3ZmMifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1075-editor-command-latency`, коммит `4d522136653f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `81019e8ef58a0a6de2e58c3982bec6e3863b818d`
  ```
  git log --all --format='%H %T' | grep 81019e8ef58a
  ```
- Тело issue: `71a856106bd060f591ad1a69db3269590a138604a980cb3b78fe76fa06845eab`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40286151484,"run_attempt":1,"digest":"e98ca6ca9aba5a2cad0fd90b5c2af846f8b844112ef6fafe59ebd83c8a56b119"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTAsIm91dHB1dF90b2tlbnMiOjQ3NDcxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIxNTY3OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY3NTgwMjcsImNvc3RVc2RFc3RpbWF0ZSI6Mi42ODkyMDc0MDAwMDAwMDF9XSwidHVybnMiOjU4LCJkdXJhdGlvbk1zIjo4NTg4MTcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjY4OTIwNzQwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=90 output_tokens=47471 cache_creation_input_tokens=215678 cache_read_input_tokens=6758027 num_turns=58 -->
