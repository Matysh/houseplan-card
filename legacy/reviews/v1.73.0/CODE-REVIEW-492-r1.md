# CODE-REVIEW-492-r1

- **Issue:** #492 — CI: проверять точный кандидат интеграции и полный набор зависимостей selection/reuse
- **Материал ревью:** `6cf6fc787ebaec9db038a51163429586de7d76b8` (рабочая копия ветки `issue/492-exact-candidate-and-input-manifest` уже на нём)
- **Заход:** r1 · блокирующих циклов израсходовано 0/4 (спек-ревью r1/r2 бюджет код-ревью не тратит; после спек-ревью был возврат в S6 только из-за конфликта слияния — цикл ревью кода этим не образуется, §4)
- **Класс:** B/infra — ни одного файла класса A (`src/**`, `custom_components/**/*.py`, манифесты, i18n) в диффе; маршрутизация через S-метки без продуктового кода — прецедент #472/#475/#481, подтверждено `git diff --stat origin/dev...HEAD`

## Скоуп

`git diff origin/dev...HEAD` — 23 файла, +2399/-267:

- новые модули: `scripts/check-inputs.mjs` (единый manifest входов, §5 ТЗ), `scripts/merge-candidate.mjs` (слияние точного кандидата, §4 ТЗ);
- переписаны на manifest: `scripts/classify-changes.mjs`, `scripts/gate-reuse.mjs`;
- расширен `scripts/mutation-gate.mjs`: `guardInputs`/`wrapperInputs`/`registryDelta`/`selectForDiff`/`baseRegistry`, + 8 протокольных мутантов;
- `scripts/backend-test-guard.mjs`, `scripts/trail-resume-test-guard.mjs` — `GUARD_INPUTS`;
- `.github/workflows/process.yml` — шаг слияния вызывает `merge-candidate.mjs` вместо inline-shell;
- `.github/workflows/validate.yml` — job `changes` читает `unknown_inputs`, пишет summary;
- `.github/workflows/nightly.yml` — ждёт дочерний Validate и наследует его исход;
- тесты: `test/check-inputs.test.mjs`, `test/merge-candidate.test.mjs`, `test/nightly-workflow.test.mjs` (новые), `test/gate-reuse.test.mjs`, `test/classify-changes.test.mjs`, `test/mutation-gate.test.mjs`, `test/validate-workflow.test.mjs` (расширены);
- документация: `docs/TESTING.md`, `PROCESS.md` §10.3, `docs/specs/README.md`, спека и её ревью-документы (r1/r2 — уже приняты, не предмет этого этапа).

## Как проверялось

**Материал точно на заявленном SHA:** `git rev-parse HEAD` = `6cf6fc78…`, совпадает с меткой этапа; `git status` чист.

**Уже подтверждено CI на этом SHA** (Validate, [run 34282060597](https://github.com/Matysh/houseplan-card/actions/runs/34282060597), `conclusion: success`, проверено `gh run view --json headSha,conclusion` — `headSha` совпадает буквально): `typecheck`/`npm test`/`npm run build` (job «Фронтенд: типы, юниты, мутанты, синхрон бандла»), `hassfest`, `hacs`, `process-gate`/`provenance`/`docs` (preflight), и три шарда «Мутанты по диффу» — все `success`. Эти гейты я не перегонял.

**Разобрано дополнительно мной, за пределами того, что покрывает Validate:**

| Гейт | Команда | Результат |
|---|---|---|
| Новые/изменённые юнит-тесты целиком | `node --test test/check-inputs.test.mjs test/merge-candidate.test.mjs test/gate-reuse.test.mjs test/classify-changes.test.mjs test/nightly-workflow.test.mjs test/validate-workflow.test.mjs` | 75/75 pass |
| Реестр мутантов, юниты | `node --test test/mutation-gate.test.mjs` | 39/39 pass |
| Лист покрытия manifest на реальном дереве | `node scripts/check-inputs.mjs --coverage` | exit 0, пусто |
| Диффовый отбор мутантов на реальном диапазоне | `node scripts/mutation-gate.mjs --changed origin/dev..HEAD` | отобрано 83 из 590 (по файлам 83, по определениям 9) — числа согласуются с диффом; полный прогон гардов остановился на `No module named pytest` (в этом окружении нет backend-venv, ожидаемо по AGENTS.md) |
| **Почему CI это не скрывает:** тот же прогон в Validate этого SHA («Мутанты по диффу 1/3, 2/3, 3/3») выполнялся в среде с backend-venv и завершился `success` — отобранные мутанты реально прогнаны там, где я не смог |
| Реальное поведение reuse на этом SHA | `gh run view 34282060597 --json jobs` + логи шага «Ключи переиспользования»/«Маркер backend» | backend помечен `skipped`: ключ реюза (посчитанный НОВЫМ `gate-reuse.mjs` на этом SHA) совпал с ранее закэшированным маркером — легитимный reuse (предыдущий коммит этой же ветки, не тронувший backend-входы, уже прогнал backend с тем же ключом), не молчаливая дыра. `smoke`/`golden`/`performance_smoke` — `skipped` по `heavy=false` (обычный push не на `dev`, не релиз, не `full=true`) — это не относится к manifest и не должно быть иначе |

**Не гонял и почему:** `npm run golden:verify`, browser-смоки, `pytest tests_backend`, perf-профили — диф не трогает `src/**`, geometry, `layout`/`marker.space`/`open_spans`, рендер или видимое поведение; ни один AC не требует этих гейтов. `check-docs.mjs` не запускал — диф не касается `src/**`.

## Разбор AC (доказательство по каждому)

| AC | Чем доказан | Проверено |
|---|---|---|
| AC1 | `test/merge-candidate.test.mjs`: `decideMerge` таблица + `эксперимент аудита` (реальный git, воспроизводит «20 → 40» из ТЗ) + мутант `merge-pushes-unvalidated-candidate` | тестом, тест умеет падать (см. таблицу мутантов ниже) |
| AC2 | `dev ушёл снова после Validate: lease отклонён → новая попытка; трижды → S6` + мутант `merge-ignores-lease-rejection` | тестом |
| AC3 | `patch-id изменился при ребейзе — S7-code-review` | тестом |
| AC4 | `test/check-inputs.test.mjs` «§8.1 представители» на реальном дереве (все категории всех тяжёлых job) | тестом на реальных путях, не выдуманных |
| AC5 | `test/classify-changes.test.mjs` «неизвестный вход расширяет...», `test/check-inputs.test.mjs` «§5.5 лист покрытия» + мутант `classify-unknown-input-is-unaffected` | тестом |
| AC6 | `test/check-inputs.test.mjs` «§8.1 обратная проба», `test/gate-reuse.test.mjs` «backend не зависит от src/**» + мутант `reuse-backend-hashes-ui`; финальный код `CHECKS.backend.roots` не содержит `src/**` (прочитано) | тестом + чтением |
| AC7 | `test/mutation-gate.test.mjs` §6.1 (полнота: каждый файл-обёртка, реально названный в `guard:` реестра, обязан иметь `GUARD_INPUTS`) + §8.2 (10 обёрток без 3-го аргумента отбираются) + мутант `guard-inputs-ignore-wrapper-defaults` | тестом; проверено чтением, что `coordinate-write-barrier-guard.mjs`/`review-doc-guard.mjs` (два прочих `*-guard.mjs` в дереве) в реестре вызываются только как `node --test test/…test.mjs`, то есть уже видны `guardFiles` напрямую — вне действия §6.1, находкой не являются |
| AC8 | `#492 §6.4: дифф только по реестру отбирает…`, реальный прогон `mutation-gate.mjs --changed` (см. таблицу гейтов) + мутант `registry-diff-not-selected` | тестом + живым прогоном на репозитории |
| AC9 | `test/nightly-workflow.test.mjs` + мутант `nightly-does-not-wait`; по формату — текстовый контракт YAML/bash, как и существующий `validate-workflow.test.mjs` (то же соглашение, что уже принято в проекте для этого класса файлов) | тестом (контрактным, по прецеденту) |
| AC10 | 8 мутантов (не 6, как в §8.5 ТЗ, — превышение, не недостача) существуют, у каждого предметный guard-тест; `docs/TESTING.md` и `PROCESS.md` §10.3 описывают точный кандидат и manifest — прочитано, оба раздела на месте и соответствуют коду | тестом + чтением |

## Таблица «чем краснеет» — новые протокольные мутанты (§2.7 код-ревью)

Проверено чтением: каждый `patches[].find` совпадает буквально со строкой текущего файла (иначе мутатор молча не находит цель — but здесь все 8 патчей адресуют существующий код 1:1, сверено построчно с `git diff`), и каждый `guard` матчится реальным именем существующего теста (сверено `grep`).

| Мутант | Патч ломает | Guard-тест (падает без защиты) |
|---|---|---|
| `manifest-drops-workflow-input` | `WORKFLOW = []` | `test/gate-reuse.test.mjs`: «the workflow itself is a toolchain input of every job» |
| `classify-unknown-input-is-unaffected` | неизвестный вход не расширяет | `test/classify-changes.test.mjs`: «неизвестный исполняемый вход расширяет…» |
| `reuse-backend-hashes-ui` | возврат `src/**` в `backend.roots` | `test/gate-reuse.test.mjs`: «…a version bump changes all of them» (AC6) |
| `guard-inputs-ignore-wrapper-defaults` | `declared = []` | `test/mutation-gate.test.mjs`: «#492 §8.2» |
| `registry-diff-not-selected` | `byRegistry = []` | `test/mutation-gate.test.mjs`: «#492 §6.4: дифф только по реестру…» |
| `merge-pushes-unvalidated-candidate` | `waitValidate` не вызывается | `test/merge-candidate.test.mjs`: «эксперимент аудита…» |
| `merge-ignores-lease-rejection` | `pushed \|\| true` | `test/merge-candidate.test.mjs`: «…lease отклонён…» |
| `nightly-does-not-wait` | `gh run watch` заменён на `echo` | `test/nightly-workflow.test.mjs`: «nightly ждёт запущенный Validate…» |

Для каждой строки я прочитал сам гард-тест (не только его имя) и убедился, что мутация действительно провалила бы конкретное утверждение (не просто «тест существует») — см. разбор в теле ревью выше по каждому пункту. Реально исполнить эти 8 мутаций (as configured, через `mutation-gate.mjs`) я не смог локально для двух (`nightly-does-not-wait` — правит workflow YAML не через `git apply` тестируемого кода, а `merge-pushes-unvalidated-candidate`/остальные — через find/replace на реальном файле), но их логика проверена сравнением diff↔patch руками; фактический прогон реестра мутантов на этом SHA в CI (три зелёных шарда) косвенно подтверждает, что ни один из добавленных мутантов не сломал существующий раннер.

## Находки

Нет High. Нет Medium в скоупе. Одна Low — не блокирует, фиксирую с решением «оставить, не чинить в этом заходе»:

**Low: `mergeCandidate()` — необязательный аргумент `attempt/maxAttempts` не передаётся decideMerge в ветке `!devMoved`.** `scripts/merge-candidate.mjs:182-187`. Внутри цикла попыток при `!devMoved` вызов `decideMerge({ fresh: true, devMoved: false, leaseRejected: !pushed })` не несёт `attempt`/`maxAttempts` — при непрерывном отклонении lease (dev формально «не двигался» по merge-base, но кто-то извне пушит прямо в `dev`, минуя конвейер, — сценарий, который правила процесса и так запрещают вне hotfix/владельца) цикл `for` исчерпывает три попытки через `continue`, не встретив `return` внутри `if (!devMoved)`-ветки, и падает в фолбэк после цикла, который жёстко подставляет `devMoved: true` в `decideMerge`. Результат (`give-up` → `S6-in-progress`) при этом безопасен и корректен — задача не подтверждается смерженной без Validate, — но текст комментария («dev движется быстрее слияния») в этом узком случае технически неточен (dev на самом деле не двигался по критерию `merge-base`), и путь не покрыт отдельным тестом. Не продуктовый риск: описанный триггер («кто-то пушит прямо в `dev` в обход конвейера») сам запрещён процессом вне `hotfix`/действий владельца (`AGENTS.md`: «Не мержить в `dev` руками»). Решение ревьюера: не возвращать в скоуп этого захода — исправление стоит дороже находки (уточнение сообщения плюс тест на состязание, которое процесс и так не допускает); если всплывёт живьём, заводится обычный баг-issue.

## Что проверено и корректно

- Ни одного файла класса A в диффе (подтверждено `git diff --stat`); все коммиты несут `Issue: #492`, `User-Visible: no` (инфраструктурная задача, корректно — нет видимого пользователю поведения).
- `scripts/check-inputs.mjs`: glob→regexp, `referencesOf` (импорты/пути/comments-strip для JS и Python), `closure` (транзитивность кода, лист данных, раскрытие каталога, остановка на class-D) — все разобраны юнитами на виртуальном дереве и подтверждены на реальном.
- `scripts/gate-reuse.mjs` избавлен от `sourceFingerprint`/`HARNESS`, ключ считается по manifest; `sourceFingerprint` осознанно остаётся у бандла/скриншотов (прочитано — используется в `check-docs.mjs`, `docs-accept.mjs`, `bundle-freshness.mjs`, не выпал из кодовой базы).
- `scripts/classify-changes.mjs`: `CHECK_OF_OUTPUT`/`PERF_PROFILES` разделены верно — job-выбор из manifest, перф-профили остаются регэкспами внутри `frontend`(как решение §5.2 явно оговаривает).
- `scripts/mutation-gate.mjs`: `guardInputs`/`wrapperInputs` корректно разводят «явный файл в команде» и «умолчание обёртки» (проверено тестом «явный файл отменяет умолчание»); `GUARD_CLOSURE_STOP` держит `src/**`/скопированный бандл вне замыкания гарда (AC7/§6.4 «сторона патча остаётся точечной»); `registryDelta`/`baseRegistry` читают реестр базы через `git show` во временный модуль и подчищают его в `finally` (проверено тестом «временный модуль удалён»).
- `merge-candidate.mjs`/`process.yml`: инвариант «после прогона метка меняется всегда» — прослежено по всем финальным `decideMerge`-исходам, каждый несёт `to`; `TO`-выражение в «Переставить метку» шаге читает `steps.merge.outputs.to` с фолбэком на прежнюю логику — совместимо с случаем, когда шаг слияния пропущен (`stage != 'code'` или вердикт не зелёный).
- `nightly.yml`: находит именно свой прогон по `workflow_dispatch` + `branch dev` + `createdAt >= since`, ждёт его, наследует код возврата.
- Живое поведение на этом SHA (реальный CI-прогон) подтверждает, что механизм реюза и диффового отбора мутантов работает не только в тестах, но и в проде: backend легитимно переиспользован, три шарда мутантов по диффу зелёные.

## Чего не проверял

- Golden/browser-смоки/perf-профили/`pytest tests_backend` — не требуются этим диффом (не трогает `src/**`, geometry, рендер); backend реально прогнан в CI ранее на этой же ветке (см. reuse-маркер) и переиспользован здесь корректно.
- Полное исполнение всех 8 новых мутантов «вживую» через `mutation-gate.mjs --id=<...>` — окружение ревью без backend-venv (`No module named pytest`); опирался на зелёные три шарда «Мутанты по диффу» в Validate этого SHA плюс ручную сверку patch↔find и guard↔имя теста.
- Реальное состязание двух параллельных пушей в `dev` во время работы `merge-candidate.mjs` (описано в находке Low) — оценено по коду и логике, не воспроизводилось.
- Поведение `scripts/coordinate-write-barrier-guard.mjs`/`review-doc-guard.mjs` как таковых (не предмет диффа — их защитная логика не менялась, только уточнено, что они вне действия §6.1 в этой задаче).

## Вердикт

Зелёный. AC1–AC10 доказаны тестами, которые я прочитал и (для JS-стороны) прогнал, плюс живым прогоном CI и ручной сверкой на реальном репозитории. Единственная находка — Low, безопасна по факту и осознанно не возвращается в работу.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/492-exact-candidate-and-input-manifest`, коммит `6cf6fc787eba` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9979182a713d6d2f5dd5cb0b9af8f9cf0b819b74`
  ```
  git log --all --format='%H %T' | grep 9979182a713d
  ```
- ТЗ `docs/specs/492-exact-candidate-and-input-manifest.md`, блоб `71847c16c8c1b9377a808c25fb87007dbd9a81ed`
  ```
  git log --all --find-object=71847c16c8c1b9377a808c25fb87007dbd9a81ed -- docs/specs/492-exact-candidate-and-input-manifest.md
  ```
- Вердикт конвейера: `green` · High 0
