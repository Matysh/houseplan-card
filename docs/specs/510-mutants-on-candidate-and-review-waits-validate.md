# #510 — Мутанты по диффу только на кандидате ревью; ревью ждёт зелёный Validate на материале; правила хендоффа

- **Issue:** https://github.com/Matysh/houseplan-card/issues/510
- **Тип / приоритет:** infra, tech-debt / P1
- **Трек:** полный — три поверхности протокола CI (`validate.yml`, `process.yml`, слияние кандидата) плюс правила процесса; критерий §5 «одна поверхность» не проходит
- **Оценка:** ценность для разработки 9/10; сложность 4/10; риск 3/10
- **Связано:** #475/#480 (мутанты по диффу и три шарда), #479 (тяжёлые гейты только на кандидате), #492 (точный кандидат ждёт Validate), #499 (reuse вердикта), #312 (материал ревью), #343 («зелёные гейты на этом SHA»), `PROCESS.md` §7.2, §8, §10.3

## 1. Проблема

Ретроспектива 08–09.09.2026 по данным GitHub Actions (404 прогона за двое суток):

- Validate — 137 прогонов, 44 отменены следующим пушем (медиана до него — 7 минут), 23 красных. Job-минут — 56 часов; **48 часов (86 %) — `changed_mutants`**: 351 шард-job по ~8 минут на каждый пуш с изменением `src/**`, `custom_components/**`, тестов или реестра; 934 минуты из них отменены до завершения. Для автора это критический путь любого промежуточного пуша: 20–25 минут вместо 3.
- Ревью-конвейер запускает 10–20-минутное ревью сразу по метке `S7`; шаг «Зелёные гейты на этом SHA» (#343) лишь сообщает ревьюеру, есть ли зелёный Validate. #437 за 08.09: девять переходов в `S7`, дважды возврат в `S6` из-за красного Validate уже после стартовавшего ревью, четыре ревью отменены пушем поверх идущего; итог — четыре документа ревью на один код-заход и r4 «повторный разбор того же дерева» (#499 закрыл только последнее).

Проверки нужны. Лишнее — их место: мутанты на каждом промежуточном пуше и ревью без гарантии зелёного CI.

## 1.1. Сценарий

Автор пушит промежуточный коммит — Validate за 3 минуты говорит, что типы, юниты, сборка и провенанс целы. Автор ставит `S7`: конвейер приводит ветку к `dev`, фиксирует материал, запускает на нём Validate с мутантами и ждёт; красный — задача возвращается в `S6` с ссылкой, ревьюер не тратит цикл; зелёный — ревью, и ревьюер видит подтверждённые гейты. Слияние кандидата после ребейза проверяется тем же составом.

## 1.2. Что человек увидит до и после

До: каждый пуш — 20–25 минут ожидания; `S7` на красном коде → ревью → `S6` → `S7`. После: пуш — 3 минуты; `S7` — один прогон с мутантами на материале (≈10–25 минут в зависимости от диффа) и только потом ревью; ни одного ревью на красном коде.

## 2. Скоуп

1. **`changed_mutants` по запросу** (§4): dispatch `mutants=true`/`full=true`, PR, schedule, кандидат беты (`Release:`); обычный push — нет.
2. **Гейт Validate перед ревью** (§5): `scripts/validate-gate.mjs` — найти завершённый dispatch-прогон на SHA материала либо запустить и дождаться; красный/отсутствующий → `S6` без ревью.
3. **Слияние кандидата** (§6): после пуша кандидата — тот же dispatch и ожидание именно его.
4. **Правила хендоффа** (§7): `PROCESS.md`, `AGENTS.md`.
5. **Отрицательные тесты протокола** (§8).

## 3. Не-скоуп

- Состав и шарды мутантов (#480), реестр, отбор по диффу — без изменений.
- Ночной полный прогон и `heavy`-гейты (#479) — без изменений; `full=true` по-прежнему включает всё.
- Ретраи Validate «до зелёного» — нет: красный возвращает автору.
- Права PAT (`Actions: write` для перезапуска job) — вне репозитория, отдельное решение владельца.

## 4. `changed_mutants` по запросу

`validate.yml`:

- `workflow_dispatch.inputs.mutants` — boolean, default `false`, описание «Мутанты по диффу на этом SHA (конвейер ревью и слияние кандидата)». `full` остаётся (default `true`) и подразумевает мутанты.
- Шаг `heavy` job `changes` печатает вторую строку `mutants_requested=true|false`; `classify-changes.mjs --heavy` читает `MUTANTS_INPUT` и экспортирует `mutantsRequested({ eventName, headMessage, fullInput, mutantsInput })`: `pull_request` → true; `schedule` → true; `workflow_dispatch` → `full === 'true' || mutants === 'true'`; `push` → `hasReleaseTrailer(headMessage)`.
- Выход `changes.outputs.mutants_requested`; условие job `changed_mutants` становится ровно `needs.changes.outputs.mutants_requested == 'true'`. Отбор по файлам живёт внутри job (`--changed`, пустой отбор — минута на checkout): при запросе job обязана исполниться, потому что гейт ревью читает её исход по job, и `skipped` был бы неотличим от «не запрашивали» (ревью ТЗ r1, Medium 2).
- Группа concurrency dispatch-прогонов уже отдельная (`validate-dispatch-<ref>`): dispatch не отменяет push-прогон и наоборот; два dispatch на одну ветку подряд — второй отменяет первый, что верно (материал сменился).

Комментарий в yml и `docs/TESTING.md` (раздел «Мутанты по диффу»): где теперь бегут мутанты и почему.

## 5. Гейт Validate перед ревью

### 5.1. `scripts/validate-gate.mjs`

CLI: `node scripts/validate-gate.mjs --repo=<owner/repo> --ref=<ветка> --sha=<материал> [--workflow=validate.yml]`. Печатает в stdout `result=green|red|missing`, `url=<ссылка>`; код выхода 0 при green, 1 иначе; при `$GITHUB_OUTPUT` — те же строки в него.

Алгоритм (`ops` инъекция как в `merge-candidate.mjs`):

1. `gh run list --workflow validate.yml --commit <sha> --json databaseId,status,conclusion,url,event,createdAt --limit 20`.
2. Кандидат в доказательства — `event == 'workflow_dispatch'` (только там мутанты могли быть запрошены). Завершённый не-success → `red`. Завершённый success — доказательство **только если** job «Мутанты по диффу» в нём исполнены и зелёные (`gh run view --json jobs`: есть ≥1 job с таким префиксом и все `success`); зелёный dispatch со `skipped` мутантами (чужой запуск с `mutants=false`) не доказательство — он игнорируется, и гейт запускает свой (ревью ТЗ r1, Medium 2). Незавершённый → ждать его.
3. Нет подходящего → `gh workflow run validate.yml --ref <ref> -f full=false -f mutants=true`; затем ждать появления dispatch-прогона на `<sha>` до `VALIDATE_APPEAR_MS` (3 мин; используются константы `merge-candidate.mjs`). Если голова ветки за это время сменилась (появился dispatch-прогон на другом SHA) — `missing` с пояснением «материал сменился».
4. Ждать завершения до `VALIDATE_TOTAL_MS` (45 мин), опрос каждые 20 с; таймаут → `red` («не завершился за 45 минут»).

Push-прогоны на том же SHA не считаются доказательством (мутантов в них нет), но и не мешают.

### 5.2. `process.yml`

Новый шаг «Validate с мутантами на материале» (`id: gate`) стоит **после `reuse` (#499) и шага «Конфликт с dev — вернуть автору без ревью»** и **перед** «Зелёные гейты на этом SHA» (#343): порядок в файле — `material` → `reuse` → возврат при конфликте → `gate` → возврат при красном → `validated` (ревью ТЗ r1, Medium 1: `reuse.outputs` должен быть уже вычислен). Условие шага — `steps.rebase.outputs.conflict != 'true'`; внутри: при `stage != code`, `reuse == true` или отсутствии ветки шаг пишет `proceed=true`, `result=skipped` и выходит; иначе вызывает `validate-gate.mjs` и пишет `result=green|red|missing`, `proceed=true|false` по его коду выхода (сам шаг всегда `exit 0`, чтобы дальнейшая логика меток отработала). Гейт добавляет в условия последующих шагов ровно одну переменную — `proceed` (`true` = green **или** skipped; `false` = red/missing), и она **заменяет только конъюнкт `steps.rebase.outputs.conflict != 'true'`**; все прочие конъюнкты существующих условий (`steps.reuse.outputs.reuse != 'true'` у установки зависимостей, Chromium и `Review` — #499, модель на reuse-ветке не вызывается; `needs.guard.outputs.stage == 'code'` там, где он есть; `steps.decide.outputs.green == 'true'` у слияния) остаются как есть (ревью ТЗ r3, Medium 1). `result` — только для текста комментария (ревью ТЗ r2, Medium 1: skip-ветка не должна ни возвращать задачу, ни блокировать ревью). Далее:

- новый шаг «Validate красный — вернуть автору без ревью», условие `steps.rebase.outputs.conflict != 'true' && steps.gate.outputs.proceed != 'true'` (на skip-ветке `proceed == 'true'` — шаг не срабатывает): комментарий по образцу шага «Конфликт с dev» — что именно (red/missing), ссылка на прогон, что делать (починить, запушить, вернуть `S7`), «цикл ревью не израсходован»; метка `S7 → S6`; `exit 0`.
- все последующие шаги ревью (`validated`, зависимости, Chromium, Claude, Review, публикация, решение, слияние, перестановка метки) получают `steps.gate.outputs.proceed == 'true'` на месте нынешнего конъюнкта `steps.rebase.outputs.conflict != 'true'`, остальные конъюнкты не трогаются: например, «Установить зависимости» — `steps.gate.outputs.proceed == 'true' && steps.reuse.outputs.reuse != 'true'`, `Review` — то же, «Слить ветку в dev» — по-прежнему `steps.decide.outputs.green == 'true'` (при конфликте `gate` не выполняется, `proceed` пуст — условие ложно, как и раньше; на reuse-ветке `proceed == 'true'`, но `reuse != 'true'` ложно — модель и зависимости по-прежнему не запускаются, тест #499 «вердикт прошлого захода применяется повторно: модель не вызывается» остаётся зелёным).
- шаг `validated` (#343) остаётся, но при `proceed == 'true'` на этапе code всегда находит зелёный dispatch-прогон и пишет ссылку на него; ветка «зелёного нет» становится недостижимой на этапе code и остаётся для spec.
- Шаг «Переставить метку» и «Позвать владельца» не должны считать gate-возврат падением: `if: always()`-логика проверяется тестом.

Этап `spec` (материал в issue/`docs/specs`) гейт не проходит — там нет кода.

### 5.3. Публикация в `main`

`process.yml` читается из ветки по умолчанию — зеркало в `main` строго после слияния в `dev` (правило #454); `validate.yml` в `main` тоже обязан совпадать (`workflow_sync`).

## 6. Слияние кандидата (#492)

`merge-candidate.mjs`: `realOps.dispatchValidate(ref)` → `gh workflow run validate.yml --ref <ref> -f full=false -f mutants=true`; `waitValidate(sha, { event: 'workflow_dispatch' })` ждёт прогон с этим событием и тем SHA (push-прогон игнорируется). В `mergeCandidate` после успешного `pushWithLease(candidate, branch, tip)` — `ops.dispatchValidate(branch)`, затем ожидание. Fake-ops в тестах получают `dispatchValidate` и регистрируют вызов; тест «слияние ждёт push-прогон, а не dispatch» — красный на мутанте.

`decideMerge`/комментарии — без изменений; в комментарий `validation-red` добавляется слово «с мутантами».

## 7. Правила хендоффа

`PROCESS.md` §8 (гейты) и §10.3 (конвейер): «Мутанты по диффу бегут на кандидате ревью и кандидате беты, не на каждом пуше. Конвейер не начинает ревью, пока Validate с мутантами на материале не зелёный; красный возвращает задачу без траты цикла.»

`AGENTS.md`, раздел хендоффа (новый пункт-правило, 08–09.09 как прецедент): один хендофф — один пуш; перед пушем локальный `node scripts/process-gate.mjs --issues` с доступным `gh` (иначе хук молчит о статусе issue); после `S7` в ветку не пушить, пока не пришёл вердикт или возврат — пуш отменяет ревью и стоит 10–20 минут раннера; `S7` ставится один раз на заход, а не после каждого фикса CI.

## 8. Отрицательные тесты протокола

- `test/classify-changes.test.mjs`: таблица `mutantsRequested` (push без трейлера → false; push с `Release:` → true; dispatch full/mutants/ни одного; PR; schedule).
- `test/validate-workflow.test.mjs`: вход `mutants` объявлен; `mutants_requested` выход и условие job; группа concurrency для dispatch отдельная.
- `test/validate-gate.test.mjs` (новый, fake `gh`): найден зелёный dispatch → green без запуска; найден красный → red; идущий → ждёт; нет → запускает и ждёт появления; появился на другом SHA → missing; таймаут → red; push-прогон не считается.
- `test/review-doc-guard.test.mjs`: шаг gate стоит после `material` **и после `reuse`** и до установки зависимостей; шаги ревью условны по `proceed`, при этом конъюнкт `reuse != 'true'` у зависимостей/Chromium/`Review` сохранён (тест #499 «модель не вызывается» остаётся); возврат в `S6` при `proceed != true`; этап spec и reuse гейт не проходят.
- `test/validate-gate.test.mjs`: `provesMutants` — job исполнены и зелёные / нет job / skipped / одна красная; зелёный чужой dispatch со skipped-мутантами игнорируется, гейт запускает свой.
- `test/merge-candidate.test.mjs`: dispatch после пуша кандидата, ожидание dispatch-прогона.
- Мутанты реестра (`scripts/mutation-gate.mjs`, гарды — `node --test`): `mutants-run-on-every-push` (classify: push → true), `review-starts-on-red-validate` (gate: red → green), `merge-waits-push-run-without-mutants` (waitValidate игнорирует событие). Каждый — отрицательным прогоном штатным раннером.

## 9. Совместимость и откат

Ветки, у которых на материале уже есть зелёный push-прогон, при `S7` получат один dispatch с мутантами — это ожидаемая цена перехода. Откат — revert; процесс возвращается к мутантам на каждом пуше.

## 10. Критерии приёмки

- AC1. Пуш в ветку задачи без `Release:` не запускает `changed_mutants`; `workflow_dispatch mutants=true`, `full=true`, PR, schedule и кандидат беты запускают (§8, тесты classify/validate-workflow; подтверждается первым же пушем этой ветки — job skipped).
- AC2. При `S7` конвейер запускает Validate с мутантами на материале и ждёт; красный/отсутствующий → `S6` с комментарием и ссылкой, ревью не выполняется, цикл не расходуется (тесты review-doc-guard, validate-gate).
- AC3. Слияние кандидата ждёт dispatch-прогон с мутантами на кандидате, не push-прогон (merge-candidate.test).
- AC4. Три мутанта §8 пойманы штатным раннером.
- AC5. `docs/TESTING.md`, `PROCESS.md`, `AGENTS.md` обновлены; после слияния `process.yml`/`validate.yml` зеркалированы в `main`.
- AC6. Перф/touch/UX не затронуты: `src/**` без изменений.

## 10.0. UX, модель данных, i18n

Не затрагиваются: пользовательского поведения нет (`User-Visible: no`), i18n, схема конфига, Store и сетевые API не меняются; release-артефактов нет.

## 10.1. Риски и меры

- Dispatch требует `actions: write` у токена шага: в `process.yml` используется `HP_PROCESS_TOKEN` (PAT владельца, им уже запускается `gh workflow run` в nightly через `GITHUB_TOKEN`); проверить на первом прогоне, при отказе — `permissions: actions: write` у job.
- Автор пушит во время ожидания gate: dispatch-прогон на старом SHA станет неактуален; шаг слияния и так откажет по #312; gate дополнительно сообщит `missing`, если увидел dispatch на другом SHA.
- Двойная стоимость на `S7` (push-прогон 3 мин + dispatch 10–25 мин) — приемлемо: это единственный прогон мутантов на заход вместо N.

## 11. Затронутые файлы

`.github/workflows/validate.yml`, `.github/workflows/process.yml`, `scripts/classify-changes.mjs`, `scripts/validate-gate.mjs` (новый), `scripts/merge-candidate.mjs`, `scripts/check-inputs.mjs` (новый скрипт как вход manifest), `scripts/mutation-gate.mjs`, `test/classify-changes.test.mjs`, `test/validate-workflow.test.mjs`, `test/validate-gate.test.mjs` (новый), `test/review-doc-guard.test.mjs`, `test/merge-candidate.test.mjs`, `docs/TESTING.md`, `PROCESS.md`, `AGENTS.md`, `docs/specs/README.md`.

## 12. Принятые предположения

- Доказательство мутантов — dispatch-прогон на точном SHA; push-прогон, даже зелёный, мутантов не содержит и доказательством не считается.
- Кандидат беты по-прежнему проверяется мутантами на push (трейлер `Release:`), потому что релизный гейт читает push-прогон.
- Правила хендоффа — текст, а не автоматика: конвейер защищает от ревью на красном, но пуш поверх идущего ревью по-прежнему отменяет его (это правильно: материал сменился).
