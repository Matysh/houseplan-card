# CODE-REVIEW-1044-r1

Issue: #1044 «CI: целевые проверки задач на всех треках, полная регрессия перед бетой»
Трек: `track:show` (метка в issue) · этап: code · заход: r1 · блокирующих циклов использовано 0 из 2
Материал: `d482ab2417202bc1c55fbaef17a6a13b3cbf7a2d` (ветка `issue/1044-targeted-task-checks`,
диапазон `origin/dev..HEAD` = 3 коммита: `87c50522f`, `120e4dbf9`, `d482ab241`)
Класс: B/C (`scripts/**`, `.github/**`, `PROCESS.md`/`AGENTS.md`/`docs/process/**`/`docs/TESTING.md`/`docs/DEVELOPMENT.md`,
`docs/release-ledger/v1.82.0/1044.json`); класса A и D в диффе нет.

## Вердикт

**Жёлтый · `route: reclassify` · `criterion: surfaces`** (вторично — `complexity`).
High: 0 · Medium: 0 (на прочитанных фрагментах не найдено).

Это не вердикт по качеству кода — в прочитанной части реализация выглядит
добросовестной и защищённой тестами (см. «Что проверено и корректно»). Это
вердикт по применимости лёгкого код-ревью трека `show` к задаче такого объёма.

## Почему `reclassify`, а не `fix`

Трек `show` по `PROCESS.md` §5 — «до трёх AC… лёгкое код-ревью» при соответствии
всем критериям §5. Задача не проходит минимум два из них:

**`surfaces`** («одна поверхность — один диалог, один модуль, один эндпоинт»).
Дифф правит 53 файла в 2332 вставленных строках, затрагивая самостоятельные
подсистемы CI-конвейера, а не один модуль:
- оценка proof (`scripts/ci-proof.mjs`, `scripts/browser-plan-proof.mjs`) —
  новый статус `pendingVisual`, новая форма `task`-плана, новый `taskGolden`
  байпас, новый путь `profile === 'product'` при `selection.tooling === false`;
- реестр переиспользуемых прогонов (`scripts/ci-registry-verify.mjs`,
  `scripts/ci-registry-records.mjs`, `scripts/ci-registry-cli.mjs`,
  `scripts/ci-registry-inventory.json` — новый сгенерированный файл);
- выбор объёма по диффу — два новых модуля
  (`scripts/task-check-scope.mjs`, `scripts/task-visual-intent.mjs`) плюс
  переписанный `scripts/classify-changes.mjs`;
- слияние/ожидание продюсера (`scripts/merge-candidate.mjs`,
  `scripts/continuation-record.mjs`, `scripts/workflow-continuation.mjs`);
- golden-контур (новый `scripts/golden-regression.mjs`, README
  `demo/golden/README.md`);
- пять сгенерированных/отредактированных workflow
  (`validate.yml`, `validate-product.yml`, `validate-tooling.yml`,
  `validate-docs.yml`, `_beta-derived.yml`) — `validate-tooling.yml` меняет
  список `paths:` почти на сотню строк;
- сам канон процесса — `PROCESS.md` переписывает §8 (объём гейтов),
  таблицу ролей, правила `ci:golden`/`Release:` на ветке задачи, раздел
  «В цикле реализации…»; синхронно правятся `AGENTS.md`,
  `docs/process/AUTHOR.md`, `docs/process/REVIEWER.md`, `docs/TESTING.md`,
  `docs/DEVELOPMENT.md`.

Это не один модуль и не один эндпоинт — это новый сквозной контракт
task-vs-release proof, затрагивающий весь путь «пуш задачи → S7 → merge →
nightly → бета» одновременно в коде и в каноне, который этот самый код-ревью
использует для своих правил (пункты «Объём гейтов», «Дешёвые гейты уже
подтверждены» в промпте ревью прямо ссылаются на новый контракт §8).

**`complexity`** (риск ≤ 3). Задача ослабляет/переопределяет условия, при
которых CI считает прогон полным и достаточным для merge/release
(`evaluateCiProof`, `registryPolicy`/`intentPolicy`, `productPushExpected`,
`pendingVisualAllowed`) — это прямое изменение надёжности гейта, который
защищает прод от регрессий на всех треках сразу. Ошибка здесь не локальна
одной фиче, а системна: ложно-зелёный `evaluateCiProof` пропускает её на
`dev`/бету для любой задачи. Риск выше 3 по одному этому факту, независимо от
качества тестов.

Остальные критерии §5 не нарушены явно: `migration` — новых
compatibility-полей конфигурации продукта нет (поля `visual`/`category` в
`release-ledger` — внутренний формат процесса, не конфиг пользователя);
`ux-contract` — видимое поведение продукта не меняется (`User-Visible: no` на
всех трёх коммитах, согласовано с диффом: правки не затрагивают `src/**` и
`custom_components/houseplan/**` вовсе); `perf-touch` — не применимо;
`undocumented` — ожидаемое поведение фиксируется прямо в этом PR (PROCESS.md
правится тем же диффом), круг замкнут на себя, что само по себе не критерий
§5, но подчёркивает, что объём задачи — не задача «с уже зафиксированным
поведением», а задача, которая **устанавливает** поведение процесса.

По `docs/process/REVIEWER.md` «Трек show»: `route: reclassify` переводит
задачу в `track:ask` и `S3-spec` — код остаётся в ветке. Это не блокировка
автора: его технические решения (см. ниже) не оспариваются, но системная
правка контракта CI такого объёма предполагает ТЗ и ревью ТЗ, а не
трёхпунктовый AC в теле issue, особенно учитывая признание риска самим
автором («Ошибка в отображении changed paths на проверки… Миграция
reader/producer происходит после merge»).

## Как проверялось

1. Прочитано тело issue #1044 и все 4 комментария (включая автоматический
   возврат «invalid browser coverage metadata» между r0 и материалом r1).
2. Сверен диапазон материала: `git log --oneline origin/dev..HEAD` = 3 коммита,
   `git rev-parse HEAD` = `d482ab2417202bc1c55fbaef17a6a13b3cbf7a2d`, совпадает
   с зафиксированным в задаче.
3. Прочитан полный `git diff --stat origin/dev...HEAD` (53 файла) и построчный
   дифф ключевых файлов: `scripts/ci-proof.mjs`, `scripts/browser-plan-proof.mjs`
   (целиком, финальный коммит), `scripts/task-check-scope.mjs` (целиком, новый),
   `scripts/task-visual-intent.mjs` (целиком, новый),
   `scripts/golden-regression.mjs` (целиком, новый),
   `scripts/classify-changes.mjs`, `scripts/merge-candidate.mjs`,
   `.github/workflows/validate.yml` (секции `changes`/`golden`/`tooling`),
   `.github/workflows/validate-tooling.yml` (секция `paths:`), `PROCESS.md`
   (весь дифф, 62 строки).
4. Прочитаны diff соответствующих тестов: `test/ci-proof-registry.test.mjs`,
   `test/task-check-scope.test.mjs`, `test/merge-candidate.test.mjs` —
   выборочно, для проверки наличия отрицательных кейсов под заявленные
   защитные AC.
5. Проверена трейлерная гигиена всех трёх коммитов (`Issue:`/`User-Visible:`).
6. Проверен `docs/release-ledger/v1.82.0/1044.json`: `category: infra`,
   обоснование соответствует факту диффа (никакого `introducedBy` не нужно —
   это не правка бета-функции).
7. Сверен зелёный Validate на материале: `gh run view 39947109401` →
   `headSha: d482ab2417202bc1c55fbaef17a6a13b3cbf7a2d`, `conclusion: success` —
   подтверждает, что это прогон именно на этом SHA, не на более старом.
8. Проверено на инъекцию через untrusted GH event-поля в изменённых workflow:
   `github.event.head_commit.message` используется только через `env:` →
   `process.env.HEAD_MESSAGE` в Node (`golden-regression.mjs`,
   `classify-changes.mjs`), не интерполируется в тело `run:` — безопасный
   паттерн, уже принятый в репозитории.

## Что проверено и корректно

- Трейлеры `Issue: #1044` на всех трёх коммитах; `User-Visible: no` — верно,
  дифф не содержит `src/**`/`custom_components/houseplan/**`, видимое
  поведение продукта не меняется, `docs/USER-GUIDE.ru.md`/changelog трогать не
  требовалось и не потребовалось.
- `docs/release-ledger/v1.82.0/1044.json`: классификация `infra` обоснована —
  задача не входит в пользовательский milestone релиза, что соответствует её
  содержанию (CI-контракт, не продукт).
- `isTaskBrowserPlan`/обратная совместимость wire-формата
  (`scripts/browser-plan-proof.mjs`): новый `scope: 'task'` на выходе
  переписывается в `{ scope: 'push', coverageScope: 'task' }` — осмысленный
  обходной путь вокруг обнаруженного в r0 дефекта (старый `trusted reader` на
  `dev` не понимал `scope=task`); зафиксирован отдельным тестом с «frozen v1
  decoder» без сетевой зависимости (`test/ci-proof-registry.test.mjs`,
  `#1044 frozen v1 decoder accepts task wire metadata…`).
- `scripts/ci-proof.mjs`: `full` всегда требует `tooling` (`proof.selection?.tooling
  === false` → `result('failed', 'full regression cannot omit tooling tests')`
  и отдельная проверка `requiredProfiles.includes('tooling')` для профиля
  `product`) — защищает именно тот инвариант, который задача ослабляет
  (точечный tooling-пропуск на обычной задаче не распространяется на `full`).
- Новый статус `pending` для «companion ещё выполняется» (замена безусловного
  `stale`) — не новая категория для системы: `pending` уже обрабатывается как
  «не готово» во всех вызывающих местах (`merge-candidate.mjs:175`,
  `validate-gate.mjs:216`, `workflow-continuation.mjs:31,72`), новое место
  просто возвращает более точный статус в уже существующий контракт.
- `scripts/task-check-scope.mjs`/`toolingDependencyPaths`: fail-closed по
  умолчанию — `unknown: true` бросает исключение
  («Task diff is unproven… retry instead of silently skipping»),
  непроинвентаризированный файл расширяет `unknown[]`, а не тихо молчит;
  подтверждено тестом `test/task-check-scope.test.mjs`
  («unowned executable input widens unit groups, not unrelated browser/HA/parity
  jobs» и «full always includes all families and an unproven diff fails with a
  recovery action»).
- `scripts/golden-regression.mjs`/`task-visual-intent.mjs`: pending-визуал
  никогда не становится release-доказательством — `pendingVisualAllowed`
  требует `dev`/`issue/*` ветку, запрещён при `candidate=true` и при
  `Release:`-трейлере; `judgePendingGolden` отдельно помечает `pendingVisual`,
  и `evaluateCiProof` отдельно отказывает `policy.name === 'release'` при
  `proof.request?.pendingVisual`. Негативный кейс в
  `test/ci-proof-registry.test.mjs` («pending visual diagnostics cannot
  publish or reuse accepted golden authority») подтверждает, что `golden`-job
  с `pendingVisual: true` не публикует переиспользуемую запись в реестр.
- `scripts/merge-candidate.mjs`/`waitValidate`: `pending`-ветка теперь требует
  доказанный `runId` и `validMergeValidation(validation)` перед
  `ops.defer(...)`, иначе бросает исключение — защита от запечатывания
  продолжения на неточном/подставном продюсере; подтверждена тестом
  («#1044 waiting on a companion seals the product identity, never the
  companion as product»).
- GH Actions injection: `github.event.head_commit.message` проходит только
  через `env:`, не инлайнится в shell — безопасно.

## Защитные AC: доказано · чем краснеет

| AC | Доказано | Чем краснеет (ordinary negative case) |
|---|---|---|
| AC1 (stable reuse / package version не глушит reuse) | `test/ci-proof-registry.test.mjs: 'ordinary task/dev validation reuses exact inputs while stable release intent remains fresh'` | `intentPolicy({}, '1.82.0').allowed` теперь `true` (ранее `false`); `intentPolicy({REF_NAME:'main'}, ...).allowed === false` и `intentPolicy({CANDIDATE_INPUT:'true'}, ...).allowed === false` остаются — обычный прогон теста, PASS на материале |
| AC2 (push proof dedup / companion wait не занимает чужой identity) | `test/merge-candidate.test.mjs: 'waiting on a companion seals the product identity, never the companion as product'`, `productPushExpected` fallback-кейсы | тест проверяет `assert.fail('deferred companion must not occupy the runner')` при попытке неверного пути — обычный unit, PASS |
| AC3 (task plan fail-closed на неизвестном диапазоне) | `test/task-check-scope.test.mjs: 'full always includes all families and an unproven diff fails with a recovery action'` | `taskCheckScope({ unknown: true })` бросает `Error('Task diff is unproven…')` — обычный `assert.throws`, PASS |
| AC4 (pending visual не даёт release-полномочий) | `test/ci-proof-registry.test.mjs: 'pending visual diagnostics cannot publish or reuse accepted golden authority'` | `records.length === 0` для `golden` при `pendingVisual: true` — обычный прогон, PASS |
| AC5 (канон синхронизирован с кодом) | разобрано чтением, не исполнением: `PROCESS.md`/`AGENTS.md`/`docs/process/AUTHOR.md`/`docs/process/REVIEWER.md`/`docs/TESTING.md`/`docs/DEVELOPMENT.md` правятся тем же диффом, содержательно согласованы с кодом (см. «Что проверено») | не защитный AC (документная синхронизация), таблица не применима |

Ни одна строка не осталась с пустым третьим столбцом — Medium по #435 здесь не
возникает. Все свидетели — обычные unit-тесты (ordinary negative input cases на
неизменённой реализации), ни один мутант не исполнялся ни автором, ни мной.

## Чего не проверял — и почему `reclassify`, а не попытка дочитать всё

- **Не читал построчно весь дифф.** Из 53 файлов построчно разобраны 10 ключевых
  (см. «Как проверялось»); остальные 43 — по `diffstat` и выборочным grep
  (`ci-registry-*`, `ci-profile-paths.*`, `continuation-record.mjs`,
  `mutation-registry.mjs`, `process-track.mjs`, `task-ci-plan.mjs`,
  `task-packet.mjs`, `validate-gate.mjs`, `scripts/browser-push-plan.mjs`,
  `scripts/browser-selected.mjs`, `test/*` остальные). На объёме
  2332 вставленных строк через дюжину самостоятельных подсистем это физически
  не умещается в бюджет лёгкого код-ревью трека `show` — это и есть материальное
  основание для `criterion: surfaces` выше, а не формальность.
- **Не прогонял `npx tsc --noEmit`/`npm test`/`npm run build`.** Зелёный Validate
  на точном SHA `d482ab241` подтверждён (`gh run view 39947109401` →
  `headSha` совпадает, `conclusion: success`) — по правилу «дешёвые гейты на
  этом SHA уже подтверждены» (#343) повторный прогон не требуется.
- **Не прогонял `node scripts/mutation-gate.mjs --check`,
  `node scripts/ci-profiles.mjs`, `node scripts/process-gate.mjs --issues`
  самостоятельно** — автор привёл команду и результат в хендоффе
  (`PASS`, с конкретными числами: 1790 определений / 0 исполненных мутантов и
  т. д.); мутанты вне ночного workflow исполнять запрещено в любом случае.
- **Не прогонял golden/smoke/performance/HA-harness.** Диффу не хватает
  правок `src/**`/`custom_components/**`, AC не называют конкретный смоук;
  `node scripts/smoke-select.mjs` в хендоффе автора сообщил «отсутствие
  исполняемого frontend diff» — полные браузерные/бэкенд наборы здесь не
  являются гейтом ревью (предрелизный гейт, не гейт ревью, §8).
- **Не проверял `docs/reviews/INDEX.md`** на предмет строк затронутой
  подсистемы — изменения не относятся ни к одному канону из списка AGENTS.md
  «Read this first» (SUN/LIGHT/CANVAS/…), это чистая CI-инфраструктура.
- **Не оценивал фактическое поведение после merge** (reader/producer миграция,
  по словам автора, «происходит после merge»; «проверку нового живого
  маршрута подтверждают последующие CI runs») — это заявленный автором риск,
  не предмет текущего ревью «по коду», но дополнительный аргумент в пользу
  `ask`: системная миграция контракта с поведением, проверяемым только
  постфактум на живом трафике, — ровно то, для чего существует спек-ревью и
  владельческое решение по риску, а не лёгкий code-review `show`.

## Побочные находки

Побочных находок нет. Политика `REVIEW_FINDINGS_POLICY`
(`{"mode":"issues", "stage":"code", "round":1, ...}`) совпадает с текстом
промпта; маршрут публикации — mode=issues (новые issue заводятся вне данного
документа, если найдены; здесь — нет материала для них).

## Маршрут

`route: reclassify`, `criterion: surfaces` (дополнительно нарушен `complexity`).
Конвейер переводит задачу в `track:ask`/`S3-spec`; код остаётся в ветке
`issue/1044-targeted-task-checks`, ничего не выбрасывается.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1044-targeted-task-checks`, коммит `d482ab241720` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f5220a757f89bc6566e54b9f245b2118fa303cec`
  ```
  git log --all --format='%H %T' | grep f5220a757f89
  ```
- Тело issue: `6f55180bbe1ec1100742f43053de63881e8ec7346a5e4433bef47d686de06e7f`
- Вердикт конвейера: `yellow` · High 0 · маршрут `reclassify` (критерий `surfaces`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTQsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozOCwib3V0cHV0X3Rva2VucyI6MjYxNTcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTEyNDM4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTY1NzYwNiwiY29zdFVzZEVzdGltYXRlIjoxLjA0MjkxOTJ9XSwidHVybnMiOjMzLCJkdXJhdGlvbk1zIjoyOTcxNzksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjA0ODIxODIwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5232 output_tokens=26178 cache_creation_input_tokens=112438 cache_read_input_tokens=1657606 num_turns=33 -->
