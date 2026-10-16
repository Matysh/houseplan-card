# CODE-REVIEW-889-r1

Материал раунда: SHA `21dff0da43f1d16352361eaebc33910b72b67dbc` (ветка
`issue/889-beta-field-policy`, рабочая копия на нём). Трек: show. Заход r1,
блокирующих циклов 0/2.

## Скоуп

Инфраструктурная задача B/C (без класса A, `User-Visible: no`): канал
публикации читается из `package.json` точного кандидата; только канонический
`X.Y.Z-beta.N` делает отсутствие дополнительных owner scene/dev/native/GPU
receipts (#858) предупреждением, а не блокером. Stable/RC/неизвестный канал,
красный/неполный full Validate, невалидный/отозванный/просроченный **явно
переданный** scene-plan или **текущий** owner-veto/повреждённая последняя
candidate-acceptance запись остаются блокерами на любом канале. Плюс две
инфраструктурные записи release-ledger (#697, #861), обнаруженные автором
попутно при read-only подготовке.

Изменённые файлы (ровно по `git diff origin/dev...HEAD`, 8 файлов):
`scripts/candidate-readiness.mjs`, `scripts/mutation-registry.mjs`,
`test/candidate-858.test.mjs`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/release-ledger/v1.80.1/{697,861,889}.json`. Совпадает с перечнем файлов
в хендоффе автора — расползания скоупа нет.

Первый вопрос по `docs/SCOPE.md`: прямого product-job здесь нет — задача
инфраструктурная (publication tooling), что и задекларировано метками
`infra`/`tech-debt`/`process`; она обслуживает способность вообще доставить
продуктовую работу до пользователя, а не сама строка Core user jobs.

## Как проверялось

Validate на этом SHA зелёный (https://github.com/Matysh/houseplan-card/actions/runs/38587063508)
закрывает дешёвые гейты целиком: `tsc --noEmit`, `npm test` (включает
`test/candidate-858.test.mjs` целиком), `npm run build` + сверку бандла.
Повторно не гонялись.

Дополнительно в этом раунде (диапазон не продуктовый — не бандл/не рендер,
поэтому ограничился прицельными гейтами):

| Гейт | Результат |
|---|---|
| `node --test test/candidate-858.test.mjs` | PASS 12/12 |
| Отрицательная проба: `manualAcceptanceRequired: !beta` → `manualAcceptanceRequired: true` (канал beta перестаёт быть льготным), тот же прогон | FAIL 1/12 (поймал ровно новый тест #889 про beta); файл восстановлен из бэкапа, `git status` чист |
| `node scripts/mutation-gate.mjs --check --id=candidate-beta-field-policy-leaks-to-stable` | ok, static-readiness execution=0 (мутанты — только ночь, по правилам трека show не гоняю) |
| `node scripts/mutation-gate.mjs --check --id=candidate-beta-forgets-full-proof` | ok |
| `node scripts/process-gate.mjs --issues` | PASS, 1 ожидаемое инфра-предупреждение (статусная метка не нужна до S7) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — смоки не выбираются, `src/**/*.ts` не тронут |

### Чего не проверял и почему

- `npm run gate:small`, полный `npm test`, `npm run build` — покрыты зелёным
  Validate на этом же SHA (#343); перегонять не стал.
- Golden/`ci:golden` — метки нет, рендер не тронут.
- Инварианты модели (`npm run invariants`) — геометрия и ссылки на неё не
  тронуты.
- Performance — в AC не назван, диапазон не влияет на бандл/рантайм карточки.
- `pytest tests_backend` — Python не тронут.
- Ночные мутанты (execution/caught) — трек show их не гоняет никогда (#709);
  проверил только статическую применимость обоих новых ID (таблица выше).
- Свежесть скриншотов документации — не гейт задачи (#697).

## AC · чем доказано · чем краснеет

| AC | Чем доказано | Чем краснеет |
|---|---|---|
| AC1: beta с отсутствующими receipts/scene-plan и зелёным proof не блокируется только их отсутствием; `warnings` сохраняют факт, не выдают его за acceptance; native/GPU инвентарь не ослаблен | `test/candidate-858.test.mjs` «#889 beta missing field/scene records are advisory…» — `ready:true`, `warnings.length===2`, `cases.length===4`, `gpu===true`; прочитано `buildCandidate` (candidate-readiness.mjs:94-139) — `cases`/`gpu` считаются как раньше, канал влияет только на маршрутизацию в `blockers` vs `warnings` | Отрицательная проба в этом раунде (`manualAcceptanceRequired: !beta`→`true`) ловит регресс канала; инвентарь `cases`/`gpu` защищён тем же кодом, что и в #858 (не менялся в этом диффе) |
| AC2: stable/RC/неизвестный/некорректный канал остаются строгими; нет CLI/env обхода | Тест «#889 stable, RC, unknown and malformed versions…» — для `1.81.0`, `1.81.0-rc.1`, `1.81.0-alpha.1`, `undefined` `ready:false`, `manualAcceptanceRequired:true`; для `not-a-version`/`beta.02`/`beta.2 extra` `candidatePolicy` бросает; канал читается из committed `package.json` в `candidateInputs` (строки 169-171), в `--candidate=`/окружении нет точки входа для канала | Зарегистрированный мутант `candidate-beta-field-policy-leaks-to-stable` (`node --test test/candidate-858.test.mjs`), static-readiness `ok` — проверено `--check` в этом раунде |
| AC3: beta всё ещё отказывает при failed/pending/cancelled/stale/missing proof и при невалидном/просроченном явно переданном scene-plan/текущем veto/повреждённой последней acceptance-записи | Тест «#889 beta still blocks every non-green full proof…» (5 статусов proof + 5 мутаций плана + битый JSON плана) и «…cannot override a current owner veto…» (`rejected`/`revoked`/битый JSON acceptance) — везде `ready:false`; прочитано: `sceneDelta` возвращает blocker на невалидный план безусловно, не завися от `policy` (candidate-readiness.mjs:59-71); `veto` в `buildCandidate` (128-130) ловит `record.invalid` и точное совпадение material+non-accepted verdict | Зарегистрированный мутант `candidate-beta-forgets-full-proof`, static-readiness `ok`; остальные ветки (scene/veto) защищены прямым отрицательным случаем внутри самого теста, отдельного mutant ID не заведено — допустимо по §2.7 («мутант в реестре ИЛИ отрицательный случай в самом тесте») |

Разбор по коду (без исполнения) подтверждает: «устаревшая, но валидно принятая» acceptance-запись для **другого** material (не совпадающего с текущим кандидатом) на beta трактуется как обычное отсутствие (warning) — это осознанно отличается от «текущего veto»/«битого JSON» и совпадает с комментарием автора в issue («явное **актуальное** veto… или повреждённая **последняя** запись»), не с произвольной любой стопкой старых записей; отдельный тест этот именно случай не называет, но поведение прямо читается из кода и не противоречит ни ТЗ, ни намерению «не блокировать бету навечно после первой невалидной правки».

## Находки

Блокирующих находок нет.

Отметил, но не завожу находкой (не дефект, наблюдение для следующего автора):
печатаемый в CI `GITHUB_STEP_SUMMARY` при `ready:true` по-прежнему показывает
только `"Prepared, not published."` без строк `warnings` (release-prepare.mjs:44-46,
не менялся в этом диффе) — сами warnings при этом видны в полном JSON на
stdout той же команды (`console.log(JSON.stringify(record, …))`, строка 44,
выполняется всегда). Текст AC/документации требует, чтобы отчёт **сохранял**
отсутствие как warnings — это выполнено; то, что краткая сводка Actions их не
дублирует, не заявлено ни в AC, ни в документации как требование, и сам этот
код в диффе не тронут. Не поднимаю до Medium: не регресс этой задачи и не
невыполненный AC.

## Что проверено и корректно

- Трейлеры коммита: `Issue: #889`, `User-Visible: no` — присутствуют,
  соответствуют содержимому (docs/infra-only, без видимого поведения); оба
  changelog не тронуты — корректно для `User-Visible: no`.
- `docs/release-ledger/v1.80.1/889.json` — `category: infra`, обоснование
  соответствует факту (нет продуктовых изменений, нет user-visible работы);
  формат совпадает с соседними записями (897/887), схема
  (`scripts/release-ledger.mjs`) не нарушена. Записи 697/861 — тот же формат,
  обоснования совпадают с комментарием автора в issue (кто обнаружил и
  почему они infra, а не line-fix/major); `861.json` отдельно подчёркивает,
  что реализация задачи #861 в этот выпуск не включена — соответствует
  действительности (в диффе нет `src/`).
- `docs/DEVELOPMENT.md` — единственный канонический дом release-механики;
  новый абзац «Beta field policy» и точечные правки «Primary prerelease path»
  корректно описывают реализацию (сверено построчно с
  `candidate-readiness.mjs`): channel только из committed `package.json`, нет
  CLI/env waiver, invalid/revoked explicit scene-plan всё равно refuse,
  текущий veto/битая запись всё равно блокер, полный proof обязателен на
  любом канале.
- `docs/STATUS.md` — абзац добавлен в ручной прозе «Current cycle and
  standing decisions», не в сгенерированный snapshot-блок — соответствует
  заявленному в самом файле контракту (строка снизу добавляется тем же
  коммитом, что и описываемое изменение).
- Регекс канала (`/-beta\.[1-9]\d*$/` поверх `versionFromTag().prerelease`)
  корректно отбрасывает `beta.0`, ведущие нули (отдельно ловит
  `versionFromTag` до регекса) и мусорные хвосты; `typeof version === 'string'`
  короткое замыкание не даёт `undefined`/отсутствующей версии упасть на
  `` `v${version}` ``.
- `candidateInputs` валидирует version через `candidatePolicy(version)` сразу
  при чтении committed-кандидата (fail-fast), а не только позже в
  `buildCandidate` — безопасное дублирование, не находка.
- Все 7 связанных задаче файлов воспроизводимо прогнаны; рабочая копия после
  экспериментов (отрицательная проба) чиста (`git status --porcelain` пуст).

## Маршрут

Критерии §5 для `track:show` пройдены: сложность/риск контролируемая (один
хорошо протестированный модуль с явными негативными случаями), одна
поверхность (release-readiness policy), нет миграции конфигов/новых
compatibility-полей, нет нового UX-контракта и нет влияния на
производительность/touch, ожидаемое поведение зафиксировано в каноническом
документе (`docs/DEVELOPMENT.md` § Release) тем же коммитом. Реклассификация
не требуется.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/889-beta-field-policy`, коммит `21dff0da43f1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fb773f35b3f1d8eee4edd43d970dd82f0585a84e`
  ```
  git log --all --format='%H %T' | grep fb773f35b3f1
  ```
- Тело issue: `04283e955156e052bc31a126b9949b462270151cc0e4f7d0596ddd464ed9e6a9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTYsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njg2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Miwib3V0cHV0X3Rva2VucyI6MzU2MDAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTkzODMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyNTUwMTkwLCJjb3N0VXNkRXN0aW1hdGUiOjEuMjYzNjk0MDAwMDAwMDAwM31dLCJ0dXJucyI6NDAsImR1cmF0aW9uTXMiOjQyNTY4NSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMjY4MzgwMDAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4658 output_tokens=35618 cache_creation_input_tokens=99383 cache_read_input_tokens=2550190 num_turns=40 -->
