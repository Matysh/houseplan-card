# CODE-REVIEW-1044-r3

Issue: #1044 «CI: целевые проверки задач на всех треках, полная регрессия перед бетой»
Трек: `track:ask` (метка в issue) · этап: code (PROCESS.md §2.7) · заход: r3 · блокирующих циклов использовано 1 из 4
Материал: `e5bef9d3e737df9d201a8f7b584a002fc5075d04` (ветка `issue/1044-targeted-task-checks`,
диапазон `origin/dev..HEAD` = 8 коммитов: `b99c53b32`, `7c0aa62e5`, `0d87f5b5e`,
`b2b2e493f`, `e195f39ca`, `c740bd105`, `2bc909a08`, `e5bef9d3e`)
Класс: B/C (`scripts/**`, `.github/workflows/**`, `PROCESS.md`/`AGENTS.md`/`docs/process/**`,
`docs/DEVELOPMENT.md`, `docs/TESTING.md`, `demo/golden/README.md`,
`docs/release-ledger/v1.82.0/1044.json`, `docs/reviews/*-r1.md`); класса A и D в диффе нет.
`git rev-parse HEAD` на момент вывода вердикта = материалу выше — совпадает.

## Вердикт

**Зелёный.** High: 0 · Medium: 0 · Low: 1 (снят ревьюером, без цикла, запись ниже).
**Маршрут:** `fix` (поле задано пакетом, не ревьюером — вердикт зелёный, `reclassify` к зелёным не применяется).

Это первое полноценное код-ревью реализации на треке `ask`: предыдущий код-ревью
(r1, см. «Закрытие раунда r2» ниже — в терминах этого документа раунд r1 код-ревью
и раунд r2 ревью ТЗ — две разные стадии одного issue) не выносил вердикт по
качеству кода вовсе, а вернул задачу по объёму (`route: reclassify`,
`criterion: surfaces`). Раунд r2 (ревью ТЗ) прошёл зелёным и формализовал тот же
объём. Настоящий раунд — первый, где сам код (а не формат/объём ТЗ) читается и
проверяется AC-за-AC для `track:ask`.

## Скоуп ревью

Общий task/release CI-контракт для `ship`/`show`/`ask`: оценка proof
(`ci-proof.mjs`, реестр переиспользования `ci-registry-*`), выбор объёма
проверок по диффу (`task-check-scope.mjs`, `classify-changes.mjs`,
`browser-push-plan.mjs`), ожидание продюсера при merge без дублирующего
dispatch (`merge-candidate.mjs`, `continuation-record.mjs`,
`workflow-continuation.mjs`), целевой visual-контур
(`task-visual-intent.mjs`, `golden-regression.mjs`, `browser-plan-proof.mjs`,
`browser-selected.mjs`), пять сгенерированных/отредактированных workflow и
синхронный переписанный канон (`PROCESS.md`, `AGENTS.md`, `docs/process/AUTHOR.md`,
`docs/process/REVIEWER.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`,
`demo/golden/README.md`). Продуктовых исходников (`src/**`,
`custom_components/houseplan/**`) и видимого пользователю поведения в диапазоне
нет — подтверждено `git diff origin/dev...HEAD --stat` (61 файл, ни одного пути
класса A/D). Разбор сделан полным (не по дельте от r1): предмет не локален —
новая подсистема, переписанный контракт поведения (§2.10 «Разбор остаётся
полным»), и сам r1 объём разбора прочёл только 10 из 53 файлов построчно.

## Как проверялось

1. Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` целиком по разделам
   §1–§5, §8, §10.4 (где касается code-ревью и объёма гейтов) и
   `docs/process/REVIEWER.md` целиком.
2. Прочитано тело issue #1044 (раздел `## ТЗ`) и все 11 комментариев —
   хронология show → жёлтый код-ревью r1 (`reclassify/surfaces`) → `track:ask` →
   зелёное ревью ТЗ r1 → три исправления после Validate-отказов
   (`invalid browser coverage metadata`, rollout-дефект `scope=task` у старого
   reader, конфликт после ребейза на производных CI-индексах, Linux-only
   fixture failures) → финальный материал `e5bef9d3e`.
3. `bodyDigest` из `REVIEW_CONTEXT` (`32c2b4755…`) сверен с «Тело issue» в
   «Материал раунда» `SPEC-REVIEW-1044-r1.md` — совпадает: текст ТЗ не менялся
   после зелёного спек-ревью.
4. Построчно прочитан полный диапазонный дифф канона: `PROCESS.md` (166 строк
   diff), `AGENTS.md`, `docs/process/AUTHOR.md`, `docs/process/REVIEWER.md`,
   `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `demo/golden/README.md` — сверено,
   что формулировки дословно соответствуют «Контракту поведения» ТЗ, а не
   только декларируют его.
5. Построчно прочитаны все пять изменённых/сгенерированных workflow-файлов
   (`validate.yml`, `validate-product.yml`, `validate-tooling.yml`,
   `validate-docs.yml`, `_process.yml`, `_beta-derived.yml`) — ключевые секции
   `changes`/`tooling`/golden job/review-prep полностью.
6. Четыре параллельных прохода (отдельные сессии, те же источники материала)
   построчно прочли и выполнили тесты для каждой группы AC:
   AC1+AC2 — `ci-proof.mjs`, `ci-registry-cli/records/verify.mjs`,
   `check-inputs.mjs`, `merge-candidate.mjs`, `continuation-record.mjs`,
   `workflow-continuation.mjs`, `validate-gate.mjs` и их тесты;
   AC3 — `task-check-scope.mjs`, `classify-changes.mjs`, `browser-push-plan.mjs`,
   `browser-selected.mjs`, `process-track.mjs`, `task-ci-plan.mjs` и тесты;
   AC4 — `task-visual-intent.mjs`, `golden-regression.mjs`,
   `browser-plan-proof.mjs`, `_beta-derived.yml`, `demo/golden/README.md`;
   AC5 — wire-формат `browser-plan-proof.mjs`/`ci-proof.mjs`, пять workflow,
   `rebase-generated.mjs`, `mutation-registry.mjs`, сгенерированные
   `ci-profile-paths.json`/`ci-registry-inventory.json`.
   Каждый проход отдельно называл конкретные тесты и строки, что подтверждено
   мной повторным чтением исходников (см. «Защитные AC» и находку Low ниже —
   я сам нашёл расхождение в комментарии теста, перепроверив по `git show`).
7. Лично прогнаны (Linux, зависимости уже стояли) целевые адресные наборы:

   | Гейт | Команда | Результат |
   |---|---|---|
   | Registry/intent/pending-visual | `node --test test/ci-proof-registry.test.mjs` | PASS 46/46 |
   | Task scope / visual intent / golden | `node --test test/task-check-scope.test.mjs test/merge-candidate.test.mjs test/task-visual-intent.test.mjs test/golden-regression.test.mjs` | PASS 68/68 |
   | Process prepare/digests | `node --test test/process-prepare-tools.test.mjs test/process-digests.test.mjs` | PASS 16/16 |
   | Push-refusal/performance/integrate/development-loop | `node --test test/publish-push-refusal.test.mjs test/performance-workflow.test.mjs test/process-integrate-tools.test.mjs test/development-loop-954.test.mjs` | PASS 59/59 |
   | Rebase-generated/workflow-contract/ci-profiles | `node --test test/rebase-generated.test.mjs test/validate-workflow.test.mjs test/ci-profiles.test.mjs` | PASS 73/73 |
   | Generated profiles актуальны | `node scripts/ci-profiles.mjs` | PASS, exit 0 |
   | Мутационный реестр — только структура | `node scripts/mutation-registry.mjs --check` | PASS, exit 0 (мутанты не исполнялись) |
   | Issue/трейлер гигиена диапазона | `node scripts/process-gate.mjs --issues` | PASS, 1 ожидаемое WARN «инфраструктурный диапазон, статусная метка не нужна до S7» |
   | Whitespace/conflict markers | `git diff --check origin/dev...HEAD` | PASS, пусто |

   Все перечисленные тесты реально умеют падать — не тавтология: см. конкретные
   отрицательные входы в «Защитные AC» ниже, подтверждённые как мной лично
   (пункты AC1/AC3 таблицы), так и параллельными проходами (AC2/AC4/AC5).
8. Зелёный Validate на точном материале подтверждён из пакета ревью:
   `https://github.com/Matysh/houseplan-card/actions/runs/39961404092` на
   `e5bef9d3e` — по правилу §343 `npx tsc --noEmit`/`npm test`/`npm run build`
   не перегонялись.
9. Проверены трейлеры всех 8 коммитов диапазона: `Issue: #1044` на каждом;
   `User-Visible: no` на коммитах с кодом/канон-правками (документ-ревью
   коммиты `b2b2e493f`/`e195f39ca` несут только `Issue:`/`User-Visible:` —
   верно для коммита документа ревью, `e195f39ca` дополнительно несёт
   `Delivery-Phase: spec-review/v1`, что соответствует правилу
   REVIEWER.md «Проверенная фаза spec-review/v1 означает только публикацию
   SPEC»). Класса A/D коммитов нет — изменения величин, видимых пользователю,
   в диффе нет физически (`User-Visible: no` везде, `src/**` не тронут).
10. `docs/release-ledger/v1.82.0/1044.json` сверен с ТЗ: `category: "infra"`,
    `baseStable: "v1.82.0"` (текущий последний реально выпущенный тег,
    подтверждено `git tag --sort=-creatordate` и `package.json.version`),
    обоснование совпадает по смыслу с «Release-артефакты» ТЗ. Нет `visual`
    блока — корректно: диапазон не трогает `src/**`/`demo/golden/baselines/**`.
11. Косвенно и неожиданно подтверждён сам rollout-контракт AC5 «миграция
    reader/producer» вживую: промпт этого самого ревью (шаг «Контекст проверок
    для ревью» `_process.yml`, строка с текстом «Дешёвые гейты на этом SHA уже
    подтверждены (#343)… npx tsc --noEmit, npm test и npm run build…») —
    это буквально СТАРЫЙ (текущий `dev`, до слияния #1044) формат текста,
    который этот самый диапазон заменяет в `_process.yml` на «План проверок
    материала подтверждён validate-gate…». Правило PROCESS.md «при расхождении
    документа и `.github/workflows/*` побеждает фактическая автоматизация»
    здесь само себя иллюстрирует: меня прямо сейчас ревьюирует старый
    контроллер из `dev`, именно так, как заявляет риск ТЗ («новые правила
    reviewer prompt начинают действовать после merge»).
12. Косвенные находки/side-эффекты: `REVIEW_FINDINGS_POLICY`
    (`{"mode":"issues","stage":"code","round":3,...}`) совпадает с текстом
    промпта — расхождений нет, маршрут публикации mode=issues подтверждён.

## Что НЕ проверялось и почему

- **Golden/браузерные смоки/performance/HA pytest не гонялись.** Диапазон не
  трогает `src/**`/`custom_components/houseplan/**`, AC не называют
  performance-влияния, Python не менялся. Автор зафиксировал в хендоффах, что
  `smoke-select` сообщал об отсутствии исполняемого frontend-диффа на каждом
  push диапазона — переисполнять не для чего: это предрелизный гейт, не гейт
  ревью (§8).
- **Инварианты модели (`npm run invariants`) не гонялись** — геометрия не
  менялась.
- **Мутанты не исполнялись** ни автором, ни мной — политика (#709) запрещает
  это вне ночного контура; `mutation-registry.mjs --check` — только
  статическая структура/якоря, не caught.
- **`npx tsc --noEmit`/`npm test`/`npm run build`/`npm run gate:small` лично
  не перегонялись** — зелёный Validate на точном `e5bef9d3e` подтверждён по
  ссылке в пакете ревью (#343); проверено только то, что Validate НЕ
  покрывает: чтение кода, адресные тесты, канон, трейлеры, release-ledger.
- **Полная матрица 61 файла не прочитана построчно для каждого файла.**
  Генерируемые/производные файлы (`scripts/ci-profile-paths.json`,
  `scripts/ci-registry-inventory.json`, пять derived workflow) не вычитывались
  построчно вручную — их согласованность с генераторами подтверждена
  исполнением: `node scripts/ci-profiles.mjs` (exit 0, `--check` внутри) и
  `ci-registry-inventory` эквивалент по тестам `ci-profiles.test.mjs`. Это
  умышленное сужение по природе файла (сгенерированное доверенным скриптом,
  не правится руками), не по бюджету — расхождение такого файла с генератором
  было бы находкой самого генератора, а не ручного чтения.
- **Поведение после merge (живая миграция reader/producer) не проверялось** —
  физически не наблюдаемо до слияния; это заявленный автором и ревью r1 риск,
  компенсированный тем, что я лично наблюдал (п. 11 выше) текущее поведение
  старого reader на этом самом ревью — косвенное, но действующее
  подтверждение, что до merge ничего не ломается.
- **`docs/reviews/INDEX.md` не содержит строк по этой подсистеме** (CI-процесс
  не входит в список канонических подсистем AGENTS.md «Read this first») —
  смотреть было нечего.

## Защитные AC: доказано · чем краснеет

| AC | Доказано | Чем краснеет (ordinary negative case) |
|---|---|---|
| AC1 (stable version не глушит reuse; nightly/fresh/настоящий release остаются строгими) | `scripts/ci-registry-cli.mjs:40-56` (`intentPolicy`): `task = /^issue\//.test(refName)` безусловно снимает `stable` для issue-веток. `test/ci-proof-registry.test.mjs:90-107` («ordinary task/dev validation reuses exact inputs while stable release intent remains fresh») | Я лично прогнал `node --test test/ci-proof-registry.test.mjs` — PASS 46/46; тест перебирает 7 «разрешить» окружений и 6 «отказать» (main, tag-ref, `CANDIDATE_INPUT`, `Release:`-коммит на dev с совпадающим stable-тегом) каждым отдельным `assert` — правка булевой логики валит конкретную строку, не весь тест |
| AC2 (S7/merge переиспользуют совместимый push proof либо ждут точный producer без дублирующего dispatch; чужая identity не занимает слот) | `scripts/merge-candidate.mjs:652` (`validMergeValidation(validation)` перед `ops.defer`) и `continuation-record.mjs` | `test/proof-loop-856.test.mjs` («#1044 a required profile completion wakes only its independently identified product proof») по очереди портит id/attempt/sha/branch/path/status/event/conclusion/created_at/repo и проверяет отказ на каждом — подтверждено параллельным проходом, перепроверено мной по названию теста в файле |
| AC3 (task-план — полный diff от merge-base с dev; неизвестный файл расширяет unit-группы, не browser/HA/perf; неизвестный диапазон — явная ошибка; task-proof не проходит release-политику) | `scripts/task-check-scope.mjs:83` (`throw Error('Task diff is unproven…')`), `:99-103` (unowned-файл только `product`/`tooling`, не `backend`/`geometry_parity`) | `test/task-check-scope.test.mjs` («unowned executable input widens unit groups, not unrelated browser/HA/parity jobs», «full always includes all families and an unproven diff fails with a recovery action») — `assert.throws`, обычный PASS; `test/browser-push-plan.test.mjs` («#1044 task proof accepts exact selected execution for S7; full release still requires full coverage») заводит task-scoped proof через реальный `CI_PROOF_POLICIES.release` и проверяет `status === 'stale'` |
| AC4 (визуальная задача хранит только свои кадры/intent; polная матрица/необъявленные кадры/pendingVisual не дают release-полномочий) | `scripts/task-visual-intent.mjs` (epoch по SHA-256 `baselines-index.json`), `scripts/golden-regression.mjs` (`judgePendingGolden`) | `test/task-visual-intent.test.mjs` («#1044 accumulates current-cycle visual intents and expires them after canonical acceptance» — реальная инвалидация эпохи после пересчёта хеша; «#1044 rejects contradictory, malformed or path-like visual intent» — конфликт change/new, путь-подобный id, пустая причина); `test/golden-regression.test.mjs` (missing-frame/dup-id/undeclared-diff/foreign-chromium каждый отдельным `assert success:false`) |
| AC5 (канон и generated workflow согласованы; старый `dev`-reader совместим с новым wire-форматом, новый не принимает недоказанное за full/release) | `scripts/browser-plan-proof.mjs:2-3,38` (`scope:'task'` сериализуется как `{scope:'push', coverageScope:'task'}`); подтверждено прямым сравнением со старым `scripts/browser-plan-proof.mjs` на `origin/dev` (`git show origin/dev:scripts/browser-plan-proof.mjs` — байт-в-байт тот же decode-путь, который реально действует на `dev` сейчас) | `test/ci-proof-registry.test.mjs` («#1044 frozen v1 decoder accepts task wire metadata without full or golden authority») — старый decode-путь кидает `/invalid browser coverage plan/` на сырое `scope:'task'` без маркера и принимает `{scope:'push',coverageScope:'task'}`; `test/rebase-generated.test.mjs` (`'commit failure'`, «#1044 a concurrent HEAD move survives both rollback layers») — реальные временные git-репозитории, не моки |

Пустых третьих столбцов нет — Medium по #435 здесь не возникает.

## Находки

**Low (снято ревьюером, без цикла).** `test/ci-proof-registry.test.mjs:285-333`,
тест `'#1044 frozen v1 decoder accepts task wire metadata without full or golden
authority'`. Комментарий теста (строки 286–287) и хендофф автора от
`2026-10-23T11:33:50Z` утверждают, что decoder — это «скачанный реальный
`proof.json` из run `39944889389`», проверенный «неизменённым старым browser
decoder… без дополнительной зависимости от git history/network». Фактически
`legacyBrowserPlanExecution` (строки 288–303) — вручную перепечатанная копия
функции `browserPlanExecution`, которая **сейчас** дословно (байт-в-байт,
проверено `diff` между `git show origin/dev:scripts/browser-plan-proof.mjs` и
функцией в тесте, расхождений нет) лежит в `origin/dev`. Никакого `proof.json`
артефакта, фикстуры или пина коммита `7b00292ec` в репозитории нет — поиск
`39944889389`/`7b00292ec` вне этого комментария и `docs/DEVELOPMENT.md:19`
(несвязанное упоминание #698) ничего не находит. Тест при этом **функционально
корректен и достаточен**: он действительно воспроизводит поведение реального,
неизменного кода `dev` (я сверил это напрямую, а не поверил комментарию), и
обязательный для AC5 факт — «старый reader отклоняет сырой `scope=task` и
принимает аддитивный `coverageScope=task`» — доказан настоящим кодом `dev`, а
не вымышленным. Дефект — только в формулировке происхождения свидетеля:
комментарий заявляет независимость от git history, которой по факту нет (это
и есть git history `dev`, просто инлайненная, а не импортированная). Снимаю
без цикла: предмет Low — неточная атрибуция в комментарии, а не недоказанный
AC или фиктивный тест; переформулировать комментарий на «скопировано с
`origin/dev` `scripts/browser-plan-proof.mjs` по состоянию на этот материал»
стоит сделать автору при следующей правке файла, отдельного возврата не
заслуживает.

## Что проверено и корректно

- **Трейлерная гигиена** всех 8 коммитов: `Issue: #1044` везде,
  `User-Visible: no` везде (видимого пользователю изменения нет — ни одного
  файла `src/**`/`custom_components/houseplan/**`/i18n в диапазоне), документ
  ревью `e195f39ca` несёт корректный `Delivery-Phase: spec-review/v1`.
  Единственное число, которое в этом диффе могло бы «быть видно дважды»
  (версия 1.82.0, пороги вроде browser-guard 200 или diffstat-счётчики из
  хендоффов) — внутренние CI-метрики, не пользовательские; пользователю этот
  диапазон физически ничего не показывает, вопрос «один ли источник у числа»
  не возникает.
- **`docs/release-ledger/v1.82.0/1044.json`**: `category: infra` обоснован
  (CI-контракт, не продукт, не входит в пользовательский milestone),
  `baseStable` соответствует текущему последнему стабильному тегу,
  `introducedBy` не требуется (не правка бета-функции).
- **AC1–AC5** — каждый реализован, протестирован отрицательными кейсами,
  которые реально умеют падать (см. таблицу выше); fail-closed подтверждён по
  всем проверенным путям (`taskCheckScope` на `unknown`, `intentPolicy` на
  неизвестных ref, `validMergeValidation`, `pendingVisualAllowed`,
  `acceptanceExpectations` id-паттерн) — ни одного fail-open пути параллельные
  проходы и мои собственные грепы не нашли.
- **Канон синхронизирован с кодом не декларативно**: формулировки `PROCESS.md`
  §3 п.13, §5.1 (`ci:golden`), таблица ролей, §8 «Объём гейтов на код-ревью»,
  `docs/DEVELOPMENT.md` «Browser progress checks on task pushes (#983)»
  дословно описывают то, что код реализует (`visual.schema/baselineIndex/
  golden/smokes`, `pendingVisual`, bounded worker) — сверено построчно, а не
  по заголовкам разделов.
- **Rollout/обратная совместимость (AC5) работает вживую**: см. п.11 «Как
  проверялось» — я сам наблюдал старый reader `_process.yml` на этом ревью,
  это прямое эмпирическое подтверждение заявленного в ТЗ плана rollout, а не
  только юнит-тест.
- **Безопасность workflow**: `github.event.head_commit.message` в изменённых
  job (`golden-regression.mjs`, `classify-changes.mjs`) передаётся только
  через `env:` → `process.env`, не интерполируется в тело `run:` — безопасный
  паттерн, инъекции нет (перепроверено на новых местах использования).
- **Rebase-generated безопасен к сбоям**: `test/rebase-generated.test.mjs`
  доказывает восстановление исходного состояния при сбое коммита и отказ при
  гонке с чужим параллельным HEAD — оба сценария используют настоящие
  временные git-репозитории, не моки.

## Закрытие раунда r2 (ревью ТЗ, `SPEC-REVIEW-1044-r1.md`)

| Находка r2 | Чем закрыта | Где видно |
|---|---|---|
| Low: ТЗ не содержит отдельной строки «touch: нет» / «производительность: нет» | Ревьюер ТЗ снял находку сам, без возврата автору (см. `SPEC-REVIEW-1044-r1.md`, «Находки») — автору нечего было чинить; код этого раунда подтверждает тот же факт: диапазон `origin/dev...HEAD` по-прежнему не касается `src/**`/`custom_components/houseplan/**` | `git diff origin/dev...HEAD --stat` текущего материала — ни одного пути класса A |

High/Medium на раунде r2 не было — закрывать нечего.

## Унаследовано из r2 (без повторной проверки)

- **Формулировки и границы АC1–АC5**, обязательные разделы §7.1, DoR §2.5,
  классификация `release-ledger.category: infra` и отсутствие продуктовых
  вопросов владельцу — приняты как проверенные `SPEC-REVIEW-1044-r1.md`
  (материал `e5afdd1b04bfc56b96b2e79f609a4ec775bb13fc`, тело issue с хешем
  `32c2b4755516d97556e34e65c3f42acd32e21bcb2db4061b3f1638c2254ec48a`, который
  совпадает с `bodyDigest` текущего `REVIEW_CONTEXT` — ТЗ не менялось после
  зелёного ревью). Я не переразбирал однозначность каждого AC заново — я
  проверял, что КОД делает заявленное, что является отдельным, не
  дублирующим вопросом.
- **Факт, что список затронутых тестовых файлов в «Плане автотестов» ТЗ
  соответствует фактическому диффу** — проверено r2 построчно; в этом раунде
  я лишь исполнял эти тесты и проверял их отрицательные случаи, не
  пересверял список файлов с нуля.
- **Дешёвые гейты на раннем материале ТЗ** (`npx tsc --noEmit`, `npm run
  build`, `npm test` 5643/5644, `gate:small`) из r2 не переносятся как
  актуальное доказательство этого раунда — материал с тех пор менялся трижды
  (rollout-фикс, ребейз-фикс, Linux fixture-фикс); актуальность дешёвых
  гейтов на текущем `e5bef9d3e` подтверждена отдельно зелёным Validate по
  ссылке (#343), не унаследована от r2.

## Побочные находки

Побочных находок нет. `REVIEW_FINDINGS_POLICY`
(`{"mode":"issues","stage":"code","round":3,...}`) совпадает с текстом
промпта; маршрут публикации — mode=issues, но материала для него не найдено:
единственная находка (Low) лежит строго в скоупе диапазона `#1044`
(`test/ci-proof-registry.test.mjs`, файл, изменённый этим же диапазоном), не
вне его.

## Маршрут

`route: fix` (поле задано пакетом; вердикт зелёный, `reclassify` к зелёным
вердиктам не применяется — `docs/process/REVIEWER.md`, «Трек show»).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1044-targeted-task-checks`, коммит `e5bef9d3e737` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7e265f1741c75bd99d302c5effe6c740ca7af948`
  ```
  git log --all --format='%H %T' | grep 7e265f1741c7
  ```
- Тело issue: `32c2b4755516d97556e34e65c3f42acd32e21bcb2db4061b3f1638c2254ec48a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3OTEsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODgxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoyMDQsIm91dHB1dF90b2tlbnMiOjkyNzA4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjQ2MTkyNSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjg1NDU3MjEsImNvc3RVc2RFc3RpbWF0ZSI6NC4xMTE4MDI3MDAwMDAwMDF9XSwidHVybnMiOjU2LCJkdXJhdGlvbk1zIjo3MzIxOTMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjo0LjExNjY4MzcwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4995 output_tokens=92726 cache_creation_input_tokens=461925 cache_read_input_tokens=8545721 num_turns=56 -->
