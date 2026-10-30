# CODE-REVIEW-1063-r1

Issue: #1063 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `2494ea29e4ed6cc557123b69524d34ed315268f9` (база `9995a8339265754a72fdb0e566f7d3001d73305f`, `dev` не сдвинулся)

## Скоуп

Класс B/C, инфраструктурный вход (PROCESS §1): три review-entrypoint
(`_process.yml`, `_ship-review.yml`, `release-review.yml`) явно закрепляют
модель и effort; task/ship-промпт и канон (`PROCESS.md` §2.7, §5,
`docs/process/REVIEWER.md`) требуют независимого разбора кода до авторских
выводов и явно вводят качество/читаемость/оставшийся легаси как предмет
находок; адресные контрактные тесты и документация синхронизированы.
Продукт (`src/**`, `custom_components/**`, бандл, эталоны) не затронут —
соответствует `User-Visible: no` на обоих коммитах и `category: infra` в
`docs/release-ledger/v1.82.0/1063.json`.

Это ревью проверяет собственный процесс код-ревью (PROCESS §10.4
«Задача правит сам конвейер...» → читается PROCESS.md целиком, §10 в
первую очередь). Отмечаю прямо: эта сессия идёт под **текущим** (не
изменённым этой задачей) контроллером `_process.yml` с `dev` — подтверждаю
это исполнением, не чтением: полученный мной промпт содержит старый блок
«Заход: r1 · блокирующих циклов...» сразу после «Этап:» (текст, который
диф этой задачи убирает оттуда) и не содержит нового блока «Учёт: заход
r1...» перед инструкцией о комментарии (текст, который диф добавляет туда).
Это прямое наблюдение совпадает с явным заявлением автора и документации
(`docs/DEVELOPMENT.md` «What the review model is allowed to do», `PROCESS.md`
§10.4): «Новая trusted workflow конфигурация активируется после S8; эта
задача проходит текущий dev controller» — заявление подтверждено, а не
принято на веру.

## Как проверялось

Независимый разбор кода предшествовал сверке с хендоффом: сначала построчно
прочитан `git diff origin/dev...HEAD` по каждому файлу (workflow env/args,
`PROCESS.md` §2.7 и трек `show`, `docs/process/REVIEWER.md`, три
сопроводительных `docs/*.md`, release-ledger запись, два изменённых и один
новый тестовый файл, `ci-profile-paths.json`/`ci-registry-inventory.json`),
прослежены вызывающие пути (кто читает `env.ANTHROPIC_MODEL`/`claude_args` —
`anthropics/claude-code-action`, подтверждено исполнением CLI, см. ниже) и
только потом сопоставлено с авторским хендоффом и гейтами.

Переиспользован проверенный план validate-gate
(https://github.com/Matysh/houseplan-card/actions/runs/40157801663,
review-light proof complete) — tsc/build/product-tooling units/range-guards
на материале не повторялись. Дополнительно (адресно, на непокрытые
риски конфигурации модели и контрактов, которых validate-gate не называет
по имени):

| Проверка | Результат |
|---|---|
| `node --test test/review-model-config.test.mjs test/process-digests.test.mjs test/model-evidence-857.test.mjs test/workflow-hygiene.test.mjs test/review-doc-guard.test.mjs` | 96/96 PASS, 0 FAIL, 0 SKIP (окружение Linux/GNU; авторские 4 SKIP — Windows-only кейсы, ожидаемо) |
| `node scripts/ci-profiles.mjs --check` | PASS |
| `node scripts/ci-registry-inventory.mjs --check` | PASS |
| `node scripts/status-snapshot.mjs --check` | PASS («snapshot block is current») |
| `git diff --check origin/dev...HEAD` | PASS, без мусора/конфликтных маркеров |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — browser-smoke нечего выбирать, соответствует диффу (только workflow/докс/тесты) |
| `claude --help` на установленном в среде CLI | подтверждает `--effort <level>` (low/medium/high/xhigh/max) как реальный флаг |
| `strings` по бинарнику установленного CLI | подтверждает `CLAUDE_CODE_EFFORT_LEVEL=` и `ANTHROPIC_MODEL` как реально читаемые переменные окружения (не придуманные автором имена) |

Это исполнение CLI — не пригодный `validate-gate` этой задачи и не замена
ему; это адресная проверка отдельного пробела: сам validate-gate не
верифицирует, что `--effort`/`CLAUDE_CODE_EFFORT_LEVEL` вообще существуют
как опции у используемого провайдера, а AC1 прямо требует этого.

### Чего не проверял

Полная Golden/browser-регрессия, pytest backend, инварианты геометрии,
прогон registry мутантов — не запускались: диф не трогает продукт, геометрию,
Python или защитные гарды продукта; эти гейты предрелизные, не гейт этого
ревью (PROCESS §8, диф подтверждён `smoke-select`). Фактическое качество
reasoning модели под новым `effort: high` не измерялось и не может быть
измерено контрактным тестом — это прямо признано и автором, и самим диффом
(«внутренний reasoning провайдера тестом не измеряется»): контракт
доказывает конфигурацию, не способность находить дефекты. Поведение
нового trusted-промпта не наблюдалось «вживую» в исполнении — оно начнёт
действовать только после S8 этой же задачи (ожидаемо, см. выше).

## AC · чем доказан · чем краснеет

Ни один AC этой задачи не является защитным в смысле REVIEWER.md
(валидация/гард/лимит/отказ продукта против внешнего входа): это
конфигурация workflow и текст промпта/канона, без пользовательского
продуктового гарда. Таблица «чем краснеет» применяется к тому, что в этих
AC ближе всего к инварианту:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (модель/effort закреплены, env/args не расходятся, не из материала issue) | Прочитан диф: `env.ANTHROPIC_MODEL`/`env.CLAUDE_CODE_EFFORT_LEVEL` и `claude_args` — буквальные строковые литералы в YAML всех трёх файлов, без `${{ ... }}`-интерполяции из `issue`/`inputs` — структурно исключает влияние тела issue. `test/review-model-config.test.mjs` (3 теста, по файлу) проверяет это как контракт; выполнен: 20/20 PASS. Чтением подтверждено, что на `origin/dev` до этой задачи `env.ANTHROPIC_MODEL` отсутствовал (виден в `git diff`) — обычный негативный случай на неизменённой истории, не на текущем материале | Обычный негативный случай: прежнее состояние файла (`origin/dev`, неизменённая история) не содержало `env.ANTHROPIC_MODEL`/`--model`, что делает `assert.equal(review.env?.ANTHROPIC_MODEL, 'claude-sonnet-5')` ложным по построению — подтверждено чтением диффа и старого `test/model-evidence-857.test.mjs`, который раньше требовал `assert.doesNotMatch(text, /--model\s/)` (строка удалена этой задачей) |
| AC2/AC3 (порядок «сначала независимый разбор, потом хендофф»; качество/легаси — предмет находок) | `test/process-digests.test.mjs` новый тест `#1063 task and ship review keep...` проверяет текстовое наличие и порядок фраз в реальном сгенерированном промпте (`promptFixture`) и в `_ship-review.yml`; выполнен, PASS. Канон (`PROCESS.md` §2.7) и конспект (`REVIEWER.md`) дословно синхронизированы — проверяется существующим общим digest-контрактом (`KEY_RULES`), выполнен в составе прогона, PASS | Негативный случай уже встроен в сам тест: `assert.doesNotMatch(shipPrompt, /Исполняй, где дёшево|`npm test`/)` и `assert.doesNotMatch(... /low — остальное/)` — старые формулировки, которые эта задача целенаправленно убрала; тест ловит их возврат |
| AC4 (целевые проверки/reuse сохранены, full не возвращается) | Прочитан диф `_ship-review.yml`/`_process.yml`: общий `npm test` убран из ship-промпта, `smoke-select`/`gate:small`-инструкции не расширены до полных прогонов; `smoke-select` на материале подтверждает нулевой frontend-дифф | id зарегистрированного свидетеля не применим (нет продуктового гарда); проверено чтением — удаление конкретных полных/нецелевых формулировок видно построчно в диффе и закреплено тем же тестом AC2/AC3 (`doesNotMatch`) |

## Находки

Находок High/Medium нет.

Замена пути проверена отдельно (§7.2, «что удалено взамен добавленного»):
старый текст «Заход: r...» в начале промпта `_process.yml` убран и заменён
эквивалентным «Учёт: заход...» в конце — не дублирование, обычное
перемещение одного источника информации без второго источника того же
числа (§8: номер захода и бюджет циклов остаются вычисляемыми из тех же
`needs.guard.outputs.*`, нигде не задублированы вручную). Старый
`assert.doesNotMatch(text, /--model\s/)` в `test/model-evidence-857.test.mjs`
заменён на `assert.match(..., /--model claude-sonnet-5\s/)` — замена
корректна и выполнена той же задачей, не оставлен «мёртвый» негативный
инвариант.

## Что проверено и корректно

- Трейлеры: оба коммита несут `Issue: #1063` и `User-Visible: no` (класс B/C,
  product/бандл/эталоны не изменены — User-Visible:no обоснован).
- `docs/release-ledger/v1.82.0/1063.json`: категория `infra` корректна по
  таблице PROCESS §11.9 («инфраструктура/документация, без изменения
  поведения продукта» → не входит в milestone релиза); `introducedBy` не
  требуется (не line-fix).
- `scripts/ci-profile-paths.json` и `scripts/ci-registry-inventory.json`
  обновлены генераторами (оба `--check` зелёные), новый тестовый файл и
  release-ledger запись корректно включены в алфавитном порядке списков.
- `validate-product.yml`/`validate-tooling.yml`: новый `test/review-model-config.test.mjs`
  добавлен симметрично в path-ignore (`validate-product`) и path-include
  (`validate-tooling`) списки рядом с соседними `review-*` записями — нет
  расхождения, какой validate видит файл.
- Три модельных entrypoint единообразны: `env.ANTHROPIC_MODEL`/`env.CLAUDE_CODE_EFFORT_LEVEL`
  и `--model`/`--effort` в `claude_args` совпадают по значению в каждом из
  трёх файлов (проверено и чтением, и тестом), `max-turns` не менялся
  (150/150/200 — прежние бюджеты, PROCESS §10.4 «Default model и max-turns
  150 не меняются без решения» обновлён тем же диффом на явное решение #1063).
- `release-review.yml`: модель/effort закреплены, но текст промпта не
  получил task/ship-специфичных инструкций «независимый разбор ⟶ хендофф» —
  это осознанно и корректно: §11.5 уже строит release-review как
  самостоятельную оценку всей линии против пользователя, не как чтение диффа
  против хендоффа автора одной задачи; AC1 «отдельная цель release-review
  сохраняется» выполнен, и это видно по неизменности его промпта помимо
  model/effort.
- Канон и конспект синхронизированы дословно (общий digest-тест
  `test/process-digests.test.mjs` — `KEY_RULES`), включая две новые ключевые
  формулировки («Независимый поиск дефектов — до авторских выводов»,
  «Качество и читаемость входят в ревью»), трек `show` получил то же
  уточнение (доказанный дефект скрытого пути относится к корректности;
  сохранённый заменённый путь остаётся Medium) синхронно в PROCESS.md и
  REVIEWER.md.
- Независимым исполнением (не только чтением) подтверждено, что
  `--effort`/`CLAUDE_CODE_EFFORT_LEVEL` — реально существующие опции
  установленного в среде Claude Code CLI с допустимым значением `high`,
  а не придуманные автором имена, которые provider молча проигнорирует.

## Унаследовано из предыдущего раунда

Не применимо — это r1, предыдущего раунда для этапа `code` этой задачи нет.

## Чего не проверял (сведено)

Полные Golden/browser/pytest/mutation прогоны — предрелизный гейт, диф их не
требует (подтверждено `smoke-select` и отсутствием изменений в `src/**`,
`custom_components/**`, геометрии, эталонах). Фактическая эффективность
reasoning модели/`effort: high` в поиске дефектов не измерялась — заявленное
ограничение самого диффа и автора, не скрытый риск.

## Побочные находки

Побочных находок нет.

## Вердикт

Зелёный. AC1–AC4 доказаны (контрактными тестами и адресным чтением/исполнением,
включая проверку CLI-флагов вне контрактного теста), трейлеры и release-ledger
корректны, замена пути объяснена, качество диффа высокое, независимое
исполнение не выявило дефектов сверх того, что уже покрыто.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1063-independent-review`, коммит `2494ea29e4ed` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d9b4b2a761c25427cbff136adf78178bd6b542e5`
  ```
  git log --all --format='%H %T' | grep d9b4b2a761c2
  ```
- Тело issue: `cda9b869b27f8de37ca38138a3c23efaa47831e96990546f9d37461a0c57b023`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NjksIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODc0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1NCwib3V0cHV0X3Rva2VucyI6MjM5MDcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTEzMjk0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjIzNTg0NywiY29zdFVzZEVzdGltYXRlIjoxLjEzOTUyMzR9XSwidHVybnMiOjQwLCJkdXJhdGlvbk1zIjo0Mjc2NjUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjE0NDM5NzQwMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4823 output_tokens=23928 cache_creation_input_tokens=113294 cache_read_input_tokens=2235847 num_turns=40 -->
