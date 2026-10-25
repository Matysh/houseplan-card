# CODE-REVIEW-1063-r2

Issue: #1063 · Трек: ask · Этап: code · Заход: r2 · блокирующих циклов 0/4
Материал: `e6477fb37bfb3f82cd701d62d12058089309e837` (база `e39a4d87f4dea6b75ead080094ac69c23ce2e902`)

## Скоуп

Класс B/C, инфраструктурный вход (PROCESS §1), без изменений: три
review-entrypoint (`_process.yml`, `_ship-review.yml`, `release-review.yml`)
явно закрепляют модель `claude-sonnet-5` и effort `high`; канон (`PROCESS.md`
§2.7, §5, §10.4) и конспект (`docs/process/REVIEWER.md`) требуют
независимого разбора кода до авторских выводов, вводят качество/читаемость/
оставшийся легаси как предмет находок; адресные контрактные тесты и
документация синхронизированы. Продукт (`src/**`, `custom_components/**`,
бандл, эталоны) не затронут — соответствует `User-Visible: no` на всех трёх
коммитах и `category: infra` в `docs/release-ledger/v1.82.0/1063.json`.

Отличие от r1 — только ребейз на продвинувшийся `dev` (новая база
`e39a4d87f` вместо `9995a8339`): единственный конфликт был в вычисляемом
снимке `docs/STATUS.md`, разрешён регенерацией. Я не доверился этому
заявлению на слово — ниже независимо перечитан весь текущий
`git diff origin/dev...HEAD` заново (не повторное применение r1-анализа к
недостижимому дереву `2494ea29e`/`d9b4b2a761c2`, которое в этом рабочем
дереве уже отсутствует — объект отсутствует, `git cat-file -t` возвращает
ошибку, что ожидаемо после ребейза/force-push и само по себе не находка).

Как и в r1, эта сессия сама идёт под **текущим** (не изменённым этой
задачей) контроллером `_process.yml` с `dev`: полученный мной промпт
по‑прежнему содержит старый блок «Заход: r2 · блокирующих циклов...» сразу
после «Этап:» и не содержит нового блока «Учёт: заход r2...» перед
инструкцией о комментарии — тот же эффект, что и в r1, подтверждён
исполнением (`env | grep -i anthropic_model` в среде пуст, `ANTHROPIC_MODEL`/
`CLAUDE_CODE_EFFORT_LEVEL` этой сессии не заданы). Ожидаемо: «новый
trusted-промпт активируется после S8».

## Как проверялось

Независимый разбор предшествовал сверке с хендоффом: построчно перечитан
`git diff origin/dev...HEAD` по каждому файлу (workflow env/args, `PROCESS.md`
§2.7/§10.4/трек `show`, `docs/process/REVIEWER.md`, три сопроводительных
`docs/*.md`, release-ledger запись, два изменённых и один новый тестовый
файл, `ci-profile-paths.json`/`ci-registry-inventory.json`) и только потом
сопоставлен с авторским хендоффом.

Переиспользован принятый proof validate-gate
(https://github.com/Matysh/houseplan-card/actions/runs/40159320380,
review-light proof complete на точном материале `e6477fb37b`) —
tsc/build/product-tooling units/range-guards на материале не повторялись.
Дополнительно, адресно на пробел «материал после ребейза — тот же код,
что принял r1»:

| Проверка | Результат |
|---|---|
| `node --test test/review-model-config.test.mjs test/process-digests.test.mjs test/model-evidence-857.test.mjs` | 20/20 PASS |
| `node --test test/workflow-hygiene.test.mjs test/review-doc-guard.test.mjs` | 76/76 PASS (итого 96/96, совпадает с заявленным автором числом) |
| `node scripts/ci-profiles.mjs --check` | PASS |
| `node scripts/ci-registry-inventory.mjs --check` | PASS |
| `node scripts/status-snapshot.mjs --check` | PASS («snapshot block is current») — доказывает, что пост-ребейзный конфликт в `docs/STATUS.md` разрешён корректно, а не руками оставлен в рассинхроне |
| `git diff --check origin/dev...HEAD` | PASS, без мусора/конфликтных маркеров |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет», тронуто 17 файлов — соответствует диффу (workflow/докс/тесты/ledger) |
| YAML-парсинг всех пяти изменённых workflow-файлов (`yaml.parse`) | OK на всех пяти — ребейз не оставил повреждённого YAML |
| `git log 9995a83..origin/dev --stat` / `git diff` | входящие коммиты dev трогают фикстуры/golden-harness/STATUS.md — не пересекаются по существу с файлами 1063 (единственное текстовое пересечение — другой диапазон строк `ci-registry-inventory.json`, оба списка сливаются без конфликта) |

### Чего не проверял

Полная Golden/browser-регрессия, pytest backend, инварианты геометрии,
прогон registry мутантов — не запускались: диф не трогает продукт, геометрию,
Python или защитные гарды продукта; предрелизный гейт, не гейт этого ревью
(PROCESS §8, подтверждено `smoke-select`). Фактическая эффективность
reasoning модели под `effort: high` не измерялась и не может быть измерена
контрактным тестом — признано автором и самим диффом. `git range-diff` между
r1-деревом и текущим не выполнялся дословно (объект r1 недостижим после
force-push/ребейза); вместо этого выполнено независимое построчное
прочтение итогового `git diff origin/dev...HEAD` — это эквивалентная или
более строгая проверка, так как судит фактический материал, а не
воспроизводимость истории.

## AC · чем доказан · чем краснеет

Ни один AC не является защитным (валидация/гард/лимит/отказ продукта против
внешнего входа) — это конфигурация workflow и текст промпта/канона:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (модель/effort закреплены литералами, env/args не расходятся, не из тела issue) | Диф: `env.ANTHROPIC_MODEL`/`env.CLAUDE_CODE_EFFORT_LEVEL` и `claude_args` — буквальные строки в YAML всех трёх файлов, без `${{ }}`-интерполяции из `issue`/`inputs`. `test/review-model-config.test.mjs` (3 теста) — контракт; 3/3 PASS | Обычный негативный случай на неизменённой истории: на `origin/dev` до задачи `env.ANTHROPIC_MODEL` отсутствовал (виден в диффе), что делает `assert.equal(review.env?.ANTHROPIC_MODEL, 'claude-sonnet-5')` ложным по построению; прежний `test/model-evidence-857.test.mjs` требовал `assert.doesNotMatch(text, /--model\s/)` — строка заменена этой задачей на позитивную |
| AC2/AC3 (независимый разбор до хендоффа; качество/легаси — предмет находок) | `test/process-digests.test.mjs` тест `#1063 task and ship review keep...` проверяет порядок и наличие фраз в реальном промпте (`promptFixture`) и в `_ship-review.yml`; PASS. Канон/конспект дословно синхронизированы общим digest-контрактом (`KEY_RULES`), PASS | Встроенный в тест негатив: `assert.doesNotMatch(shipPrompt, /Исполняй, где дёшево\|npm test/)`, `assert.doesNotMatch(... /low — остальное/)` — старые формулировки, которые задача убрала; тест ловит их возврат |
| AC4 (целевые проверки/reuse сохранены, full не возвращается) | Диф `_ship-review.yml`/`_process.yml`: общий `npm test` убран из ship-промпта, oracle-пробел отделён от failed-test; `smoke-select` подтверждает нулевой frontend-дифф | id свидетеля не применим (нет продуктового гарда); проверено чтением — конкретные удалённые формулировки видны построчно и закреплены тем же `doesNotMatch` |

## Находки

Находок High/Medium нет.

## Что проверено и корректно

- Трейлеры: все три коммита несут `Issue: #1063` и `User-Visible: no` —
  обоснованно, продукт не изменён.
- `docs/release-ledger/v1.82.0/1063.json`: категория `infra` верна по таблице
  PROCESS §11.9 («инфраструктура/документация, без изменения поведения
  продукта» → вне milestone релиза); `baseStable: v1.82.0` совпадает с
  текущим latest-stable; `introducedBy` не требуется (не `line-fix`).
- `ci-profile-paths.json`/`ci-registry-inventory.json`: оба `--check`
  зелёные, новая запись добавлена в алфавитном порядке списков.
- `validate-product.yml`/`validate-tooling.yml`: `test/review-model-config.test.mjs`
  симметрично добавлен в path-ignore и path-include рядом с соседними
  `review-*` записями, без расхождения, какой validate видит файл.
- Три модельных entrypoint единообразны по значениям `env`/`claude_args`,
  `max-turns` не менялся (150/150/200).
- `release-review.yml` получил только model/effort — текст и самостоятельная
  цель «оценка всей линии перед stable» не затронуты, что соответствует
  AC1 «отдельная цель release-review сохраняется».
- Входящие в `dev` за время ребейза коммиты (фикстуры 1061/845,
  golden-harness, `room-contact-grid`, подготовка beta2) не пересекаются по
  существу с файлами задачи; `docs/STATUS.md` — единственный текстовый
  конфликт, разрешён регенерацией и подтверждён `--check`.
- Документ r1 (`docs/reviews/CODE-REVIEW-1063-r1.md`) сохранён в материале
  без изменений, 184 строки, как и было до ребейза.

## Закрытие раунда r1

У r1 не было находок (зелёный, 0 High/Medium) — таблицы закрытия по существу
нет. Единственное событие между r1 и r2 — ребейз, не правка по замечанию
ревью:

| Что произошло между r1 и r2 | Чем закрыто | Где видно |
|---|---|---|
| Ребейз ветки на продвинувшийся `dev` (конфликт в вычисляемом `docs/STATUS.md`) | Снимок регенерирован скриптом, не правлен руками | `node scripts/status-snapshot.mjs --check` → «snapshot block is current»; `git diff origin/dev...HEAD -- docs/STATUS.md` содержит только числа тестов и новый абзац раздела «Review policy (#1063)», идентичный по содержанию тому, что уже было в материале r1 |

## Унаследовано из r1

Из r1 (`docs/reviews/CODE-REVIEW-1063-r1.md`, материал `2494ea29e4ed6cc5…`,
дерево `d9b4b2a761c25427…`, зелёный, 0 High/Medium) принято без повторного
исполнения:

- Подтверждение исполнением, что `--effort`/`CLAUDE_CODE_EFFORT_LEVEL` —
  реально существующие опции установленного Claude Code CLI (`claude --help`,
  `strings` по бинарнику) — конфигурация CLI не менялась этим ребейзом, нет
  основания перепроверять заново.
- Наблюдение, что эта самая ревью-роль в задаче об изменении ревью-роли
  неизбежно судит себя под старым контроллером до S8 — структурное свойство
  конвейера (#312/§10.4), не специфика конкретного SHA; r2 независимо
  воспроизвёл то же наблюдение исполнением (см. «Скоуп» выше), а не просто
  скопировал вывод r1.

Для всего содержательного (workflow env/args, PROCESS.md/REVIEWER.md, три
тестовых файла, release-ledger) r2 выполнил собственное независимое чтение
текущего `git diff origin/dev...HEAD`, а не принял выводы r1 на веру — дерево
r1 недостижимо локально после ребейза, поэтому побайтовое сравнение
(`git range-diff`) невозможно; вместо него проведён прямой повторный разбор
итогового материала (раздел «Как проверялось» выше).

## Чего не проверял (сведено)

Полные Golden/browser/pytest/mutation-прогоны — предрелизный гейт, диф их не
требует. Фактическая эффективность reasoning `effort: high` в поиске
дефектов не измерялась — заявленное ограничение самого диффа и автора, не
скрытый риск. Побайтовое `git range-diff` r1→r2 не выполнялось технически
(объект недостижим); заменено независимым построчным чтением итогового диффа.

## Побочные находки

Побочных находок нет. Маршрут публикации: `mode: issues` (см. доверенный
снимок prepare) — не применяется, так как находок вне скоупа нет.

## Вердикт

Зелёный. AC1–AC4 доказаны (контрактными тестами 96/96 и независимым чтением
итогового диффа), трейлеры и release-ledger корректны, ребейз не внёс
содержательных изменений сверх регенерации вычисляемого снимка, независимое
исполнение не выявило дефектов.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1063-independent-review`, коммит `e6477fb37bfb` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `02836f4e6f7d73c2a242453f29bcf2f520f35c53`
  ```
  git log --all --format='%H %T' | grep 02836f4e6f7d
  ```
- Тело issue: `cda9b869b27f8de37ca38138a3c23efaa47831e96990546f9d37461a0c57b023`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NzEsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODcxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3MCwib3V0cHV0X3Rva2VucyI6MjEyMDksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzYzNzMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMjIyMDUxLCJjb3N0VXNkRXN0aW1hdGUiOjAuOTYyMTMyMjAwMDAwMDAwMn1dLCJ0dXJucyI6NDMsImR1cmF0aW9uTXMiOjI2NTExMSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTY3MDAzMjAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4841 output_tokens=21229 cache_creation_input_tokens=76373 cache_read_input_tokens=2222051 num_turns=43 -->
