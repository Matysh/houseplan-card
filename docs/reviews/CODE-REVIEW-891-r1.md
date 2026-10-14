# CODE-REVIEW-891-r1

Issue: #891 · Трек: ask · Заход r1 · блокирующих циклов 0/4
Материал: `e36a3417aef46e48d10c0b1adf9c48b1b4249d59` (`issue/891-history-safety`, `origin/dev...HEAD`)
Спецификация: тело issue #891, принята зелёным на SPEC-REVIEW-891-r2 (High 0, Medium 0).

## Скоуп

`git diff origin/dev...HEAD --stat`: 38 файлов, +797/−52. Коммиты (все с `Issue: #891`,
последний также с `User-Visible: yes`):

- `4258acb9` fix: preserve geometry history on own write refusals (`User-Visible: yes`,
  CHANGELOG.md+ru.md в этом же коммите)
- `fe6c0738` test: pin actual node release failure taxonomy (`no`)
- `4485f681` fix: fence retired node-write completion (`no`)
- `458cb5bd` fix: restore accepted history cursor after retryable write refusal (`no`)
- `c616dd01` fix: keep historical background carriers outside a refused batch (`no`)
- `012a64be` fix: advance pending physical baseline after an accepted send (`no`)
- `e36a3417` fix: keep retry cursor rollback within the fifty-command history limit (`no`)

Это первый код-ревью раунд (`r1`, 0/4 циклов): предыдущие авторские итерации
(8079067d → 21a37b86 → 17816060 → e36a3417) все отозваны автором/координатором
до запуска модели (merge-conflict, формальный gate `handoff.risks`, авторские
read-only находки AC2/capacity) — ни одна не образовала цикл ревью, что
совпадает с «заход r1 · 0/4» в задаче.

Классы изменений: **A** (`src/**`, `custom_components/houseplan/**`, `i18n/**`) и
**C** (`docs/**`). Инфраструктурных файлов (demo/scripts/tests) — только
companion-тесты и новый `demo/smoke_wall_chain_history.mjs`.

## Риск по изменённым участкам (#707) — трек ask: сверка с AC ТЗ

| Класс | Участок | AC ТЗ |
|---|---|---|
| geometry | `src/wall-node-editor.ts` (catch-блок drag-отказа) | AC4 — «actual node editor release distinguishes conflict/proof/temporary» |
| migration | `custom_components/houseplan/websocket_api.py:1891` — `WallSegmentMigrationError` убран из конкретного except и накрыт общим `except Exception` | AC3 — «injected migration/internal failure → retryable code» |
| devices | `custom_components/houseplan/websocket_api.py:1891-1895` (тот же hunk — узкий `ws_wall_node_move` классификатор) | AC3/AC4 — тот же контракт, файл класса «devices» по пути, но правка — node-move taxonomy |
| ux | новые i18n-ключи `backup.error.node_move_backend_unavailable`, `node_move_write_conflict`, `node_move_write_unavailable` (en/ru/de/fr + tools/*) | Раздел «i18n» ТЗ называет эти ключи явно; AC3/AC4/AC5 используют их |

Все четыре класса покрыты строками контракта/AC; не нашёл ни одного
непокрытого — повышать в `reclassify` нет оснований.

## Как проверялось

### Гейты, уже подтверждённые Validate на этом SHA (не перегонял)

Прогон: https://github.com/Matysh/houseplan-card/actions/runs/38643850262 (success).
Проверил по логам джобов именно этого run, а не поверил заявлению автора:

| Гейт | Результат на `e36a3417` |
|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | джоб «Фронтенд: типы, юниты, мутанты, синхрон бандла» → success |
| `pytest tests_backend` (реальный HA harness, не pure-only) | джоб «Бэкенд: pytest в Home Assistant» → `1425 passed, 1 skipped in 44.81s`; нет строки «HA harness NOT collected» — харнесс действительно собрал `test_ha_*.py` |
| `process-gate --issues` | джоб «Предполёт» → success |

### Гейты, которые прогнал сам (локально, на этом SHA)

Validate в этом run **не выполнял** ни одной смоки (джобы «Смоки в браузере»,
«Перф-смок», «Golden-кадры», «Геометрия: TS/Python parity», «Мутанты по
диффу» — все `skipped`; мутанты в разработке не гоняются ни на одном треке —
это ожидаемо, §2.7). Раз риск по диффу — геометрия/UX истории, смоки беру на
себя:

1. `npm run build` (локально) + `node scripts/bundle-sync.mjs` → собрал свежий
   бандл на `e36a3417` для `demo/serve.mjs` (committed `dist/` на этой ветке
   умышленно не обновляется — «Bundle — только release»; после проверки вернул
   `dist/` к закоммиченному `npm run bundle:clean`, рабочее дерево чисто).
2. `node demo/smoke_wall_chain_history.mjs` (новая смока AC1, исполняет
   настоящие Ctrl+Z/Ctrl+Shift+Z/toolbar/Ctrl+Y на реальной draw-цепочке) →
   **OK**.
3. `node demo/smoke_node_history_context.mjs` (AC4, включая новый блок с
   четырьмя причинами отказа native drag: conflict/timeout/backend/proof) →
   **OK**.
4. `node demo/smoke_geometry_history_refusal.mjs` (обновлённый текст
   `history.unavailable`) → **OK**.
5. `node --test test/command-stack.test.mjs test/geometry-history-refusal.test.mjs
   test/node-refusal.test.mjs test/wall-node-editor.test.mjs
   test/node-history-runtime.test.mjs` → 96/96 pass.
6. **Проверка, что тест умеет падать** (не поверил формулировке реестра
   мутантов «execution=0» — применил два мутанта вручную):
   - `physical-refusal-clears-independent-history` (`stack.removeWhere(...)` →
     `stack.clear()`): все 9 тестов AC2 в `geometry-history-refusal.test.mjs`
     падают (`only second provisional identity is retired: 0 !== 1` и т.д.).
   - `physical-refusal-cursor-exceeds-history-capacity` (снял capacity-guard
     в `restorePosition`): тест `count=50` в `command-stack.test.mjs` падает
     (`combined Undo + Redo cardinality is bounded: 51 !== 50`) — это ровно
     тот edge case, который автор сам нашёл до ревью и закрыл в `e36a3417`.
   - Оба мутанта восстановлены на оригинал после проверки; `git status`
     чист (не считая untracked `test-build/`, `demo/srv/assets` — сгенерированы
     локально, не коммитятся).
7. Прочитал backend-классификатор (`custom_components/houseplan/websocket_api.py`
   `ws_wall_node_move`) построчно и сверил коды исключений с источниками:
   `NodeMoveError`/`JunctionLimitError`/`OpeningPassageError`/
   `PartitionOpeningHostError`/`PartitionOpeningJambMarginError` сохраняют
   точные коды; `vol.Invalid` → `node_move_invalid` с нейтральным текстом;
   всё остальное (включая `WallSegmentMigrationError`, `TypeError`, `KeyError`,
   `ZeroDivisionError`) → `node_move_backend_unavailable`. Сверил реальные
   коды `JunctionLimitError` (`angle`/`valence`/`length`/`distance`) и
   `NodeMoveError` (`invalid`/`opening_blocked`/`unsupported_junction`) против
   белого списка `PROOF` в `src/wall-node-refusal.ts` — множество точное, не
   избыточное и не урезанное. Проверено чтением, не исполнением (backend-метод,
   но сам прогон pytest на этом SHA в Validate зелёный — AC3 доказан и
   исполнением тоже).

### Негативные свидетели по каждому защитному AC (таблица §2.7)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | `test/geometry-history-refusal.test.mjs` («a second active-chain history reset…») + `demo/smoke_wall_chain_history.mjs` (перепрогнано) | мутант `wall-chain-history-transient-reset-clears-redo-journal` (заменяет `if (!preserveWallChainRedo)` на безусловный `[]`) |
| AC2 | 9 unit-тестов (`geometry-history-refusal.test.mjs`) + `test/command-stack.test.mjs` (капасити) | 4 мутанта в реестре; 2 проверены исполнением вручную (см. выше), падают корректно |
| AC3 | `tests_backend/test_ha_websocket.py::test_issue_891_node_processing_refusal_is_safe_retryable_and_does_not_write` (4 параметра: migration/type/unexpected/invalid) + `test/node-refusal.test.mjs` | мутант `node-backend-processing-is-geometry-proof` (подменяет код на `node_move_invalid`); backend-тест также проверяет отсутствие `"private"` в сообщении и неизменность rev/config/events |
| AC4 | `test/wall-node-editor.test.mjs` (6 кодов отказа) + `demo/smoke_node_history_context.mjs` (перепрогнано, 4 причины через реальный drag) | мутант `node-editor-every-write-refusal-is-unsafe-geometry` |
| AC5 | `test/node-refusal.test.mjs` («pinned node Undo and Redo…», плюс literal-oracle на `history.unavailable` RU/EN, что «Redo» не называется «Undo») | отрицательный `canShow=false` в обеих ветках в самом тесте |
| AC6 | существующие #843/#883 мутанты (permission/revision/fixed-floor/selective refusal) не тронуты; сам факт сохранения прочих `.clear()`-вызовов для внешней ревизии (`houseplan-card.ts:553,3988,7378`, `houseplan-editor-runtime.ts:9233,9421`) проверен чтением — ни один из них не удалён, удалены только 2 вызова в strict-write-rollback путях | существующие мутанты реестра (не новые) |

Третий столбец не пуст ни у одного защитного AC.

## Находки

Не нашёл High/Medium в скоупе и вне скоупа.

Мелкое наблюдение, не находка: `src/wall-node-refusal.ts` классифицирует код
`wall_model_version_unsupported` как `incompatible`, но нигде в репозитории
(backend/frontend) этот код сейчас не порождается — только
`wall_model_client_outdated` реален. Мёртвая ветка безвредна (код просто
никогда не срабатывает), менять не прошу.

## Что проверено и корректно

- Контракт п.1 (AC1): `_clearGeometryGesture(preserveWallChainRedo)` —
  редо-журнал активной цепочки переживает повторный transient reset; явное
  завершение цепочки (`_finishWallChainForNavigation`) по-прежнему не передаёт
  `true` и завершает журнал — проверено чтением всех вызовов
  `_clearGeometryGesture`/`_showGeometrySpace`.
- Контракт п.2 (AC2): `PhysicalWriteHistory` различает provisional-команды и
  уже принятые cursor-шаги по identity (`position`), ограничивает rollback
  только физическими полями (`PHYSICAL` в `physical-write-history.ts` совпадает
  1:1 с `SpaceGeometryState`), ребейзит только presentation-команды,
  созданные именно в отвергнутом батче, не трогая более старые независимые
  снимки. Проверено и исполнением (9 тестов + 2 мутанта вручную), и чтением.
  `restorePosition` корректно не резервирует capacity: если новый стек уже
  заполнил лимит 50, отсутствующая старая identity не восстанавливается
  (проверено мутантом).
- Контракт п.3/п.4 (AC3): конечный список кодов-доказательств в
  `wall-node-refusal.ts` сверен с реальными исключениями backend —
  совпадает точно. Backend отправляет `node_move_backend_unavailable` без
  сырого traceback/текста исключения при любой необработанной/миграционной
  ошибке, не трогая rev/config; домен-ошибки и `vol.Invalid` сохраняют код.
- Контракт п.5 (AC5): `history.space_pinned` заменяет `history.space_unavailable`
  в обеих ветках (Undo/Redo), старый ключ нигде в `src/`/`test/`/`demo/` не
  остался; `history.unavailable` теперь нейтрален к направлению на всех 4
  языках (en/ru/de/fr), литеральная проверка есть в юнит-тесте.
- i18n: все новые ключи присутствуют в 4 основных + 4 tools словарях
  одинаково; `backend.ERROR_CODES` обновлён (`node_move_backend_unavailable`
  добавлен во `frozenset`).
- Трейлеры: `Issue: #891` на каждом коммите; единственный `User-Visible: yes`
  несёт оба CHANGELOG в том же коммите.
- Release-ledger (`docs/release-ledger/v1.80.1/891.json`): `category:
  stable-fix` с `rationale`, явно разделяющим pre-v1.80.1 часть контракта
  (п.1/2/4/5) от `line-fix introducedBy #843` (клиентский классификатор AC3,
  `src/wall-node-history.ts` целиком создан после `v1.80.1`/`beta.1`) —
  решение уже прошло отдельную проверку на SPEC-REVIEW-891-r2 (сверено с
  `scripts/release-ledger.mjs`: схема не поддерживает «mixed»-категорию,
  поэтому разделение живёт в свободном `rationale`/`summary`, что и
  реализовано). Авторское суждение корректно отражает код.
- Одно число — один источник: лимит истории 50 — существующая константа
  `CommandStack` (не новая, не продублирована новым числом где-то ещё);
  изменение добавляет только *поведение у границы*, не новое число.

## Чего не проверял

- Полную матрицу `golden:verify`, `npm run invariants`, полный `pytest
  tests_backend -q`, полный набор смоков (332) и мутанты по диффу — не
  запускал сам; это предрелизный объём, не гейт этого ревью (§8), и правка не
  меняет геометрические вычисления (только bookkeeping истории/классификацию
  ошибок), поэтому TS/Python parity и `npm run invariants` не требуются этим
  диффом — соответствующие джобы Validate сами выставили `skipped` по paths-filter.
- `pytest tests_backend -k issue_891` сам не перезапускал (нет
  `homeassistant`/`.venv-backend` в этом окружении) — положился на лог
  джоба «Бэкенд: pytest в Home Assistant» того же run на этом точном SHA
  (`1425 passed, 1 skipped`, харнесс действительно собран), плюс построчное
  чтение классификатора и пяти параметризованных сценариев в
  `tests_backend/test_ha_websocket.py`.
- Остальные 27 «слабая связь» строк `smoke-select.mjs` (align_guides,
  card_tool_conflict и т.п.) — не прогонял; связь с диффом некрепкая (общий
  `_path`/`spaceId`), решение оставляю как учтённое, не обязательное.
- Полный ручной UI-проход (десктоп-браузер, не Playwright) не делал; доверяю
  исполнимым Playwright-смокам как первичному UI-свидетелю для AC1/AC4.

## Вердикт

High: 0 · Medium: 0. Зелёный, цикла не образует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/891-history-safety`, коммит `e36a3417aef4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `761e6b29d0073be1c1bac2fddbbeabc871b01e89`
  ```
  git log --all --format='%H %T' | grep 761e6b29d007
  ```
- Тело issue: `ddb47b51dd4dff7a187f908c11997bd6319bf27702c0e29907b46599745b09b4`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3OTgsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODk4MDAwMDAwMDAwMDAwNH0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTY4LCJvdXRwdXRfdG9rZW5zIjozOTQ1MCwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNjE2NDQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMDQyOTc3MiwiY29zdFVzZEVzdGltYXRlIjozLjEyNzM2NjR9XSwidHVybnMiOjg4LCJkdXJhdGlvbk1zIjo2Mjg1NzAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjozLjEzMjI2NDQwMDAwMDAwMDQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4966 output_tokens=39470 cache_creation_input_tokens=161644 cache_read_input_tokens=10429772 num_turns=88 -->
