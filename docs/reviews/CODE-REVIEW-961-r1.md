# CODE-REVIEW — issue #961, r1

Материал: `fbd500798e78e497a6b9e121526dfdaadcf9c152` (рабочая копия на нём, `git fetch/checkout` не выполнялись).
Трек: `show`. Заход: r1, блокирующих циклов израсходовано 0 из 2.
Доверенный снимок находок: `mode=issues`, `path=null` — побочные находки вне скоупа заводятся отдельным issue; внутри скоупа возвращаются автору.

## Скоуп

Issue #961 — регрессия `process-resume.mjs`: job «Разбудить раунд, ждавший этот Validate» отклонял завершённый sealed-green результат #957 с `completed model seal invalid: доверенная политика находок: findings policy: invalid review identity`, хотя соседняя job «Exact pending candidate completion» вела себя корректно (`noop / stale-or-foreign-child`, ждёт другой запрошенный Validate).

Диапазон коммитов `origin/dev..HEAD` — один коммит `fbd500798` (`fix(process): bind resumed findings to trusted repository (#961)`, трейлеры `Issue: #961` / `User-Visible: no` на месте). Диапазон `origin/dev...HEAD`:

- `scripts/process-resume.mjs` — 1 содержательная строка + комментарий;
- `test/pipeline-outcomes-897.test.mjs` — новые кейсы на существующих фикстурах;
- `docs/DEVELOPMENT.md`, `docs/STATUS.md` — документация находки/исправления;
- `docs/release-ledger/v1.81.0/961.json` — новый.

Продуктовый код (UI/рендер/модель плана), workflow-права и `review-result-gate.mjs`/`review-findings-policy.mjs` не меняются — только потребитель `resumeEvidence`. `smoke-select --base origin/dev --head HEAD --json` → `"noExecutableDiff": true`, браузерные смоки не требуются.

## Разбор по коду

Корень бага: `prepared.json`, который кладёт стадия `prepare` (`.github/workflows/_process.yml:1047`), никогда не содержал поле `repo` (список `PASSPORT_FIELDS` в `review-result-gate.mjs:28-34` тоже его не включает). До фикса `resumeEvidence` передавал в гейт `expected: prepared` буквально — значит `expected.repo === undefined`. `reviewResultProblems` строит `readFindingsPolicy(snapshot, { repo: expected.repo, ... })` (`review-result-gate.mjs:97-99`), а та вызывает `identity()` (`review-findings-policy.mjs:23-27`), которая требует `typeof repo === 'string'` и падает с ровно тем текстом, что в наблюдении issue: `findings policy: invalid review identity`. Это воспроизводится чтением кода без исполнения мутанта: кейсы `policyEvidence()` в `test/pipeline-outcomes-897.test.mjs` не передают `preparedOver.repo`, то есть `passport.repo` остаётся `undefined` — ровно сценарий регрессии.

Соседний путь проверки того же результата — прямой вызов `review-result-gate.mjs` CLI в основном workflow (`_process.yml:1151` и далее) — не задет: там `expected.repo = process.env.REPO` уже выставлялся явно (`review-result-gate.mjs:157`), поэтому баг проявлялся только в отложенном `resume`-пути, что и совпадает с наблюдением автора (одна job падает, соседняя — нет).

Фикс (`scripts/process-resume.mjs:114-116`): `expected: { ...prepared, repo }`, где `repo` — аргумент функции `resumeEvidence`, который приходит из `resume({ repo, ... })`, а на проде — из `REPO: ${{ github.repository }}` в `.github/workflows/_process-resume.yml:88,99`. Порядок спреда (`repo` после `...prepared`) гарантирует, что доверенное значение контроллера побеждает любое постороннее `repo` внутри скачанного `prepared.json`/`findings_policy_snapshot` — ровно то, что требует AC1/AC2 («репозиторная authority — аргумент контроллера, а не поле артефакта»). Другие потребители `prepared` (`preparedEvidenceError`, сравнение `PASSPORT_FIELDS`) поле `repo` не используют — побочных эффектов от добавления поля в объект `expected` нет.

### AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (repo контроллера, не поле артефакта; verified noop issues/file, push/workflow_dispatch, без relabel/retry/второго вызова модели) | `#961 sealed issues/file policy result stays a verified noop for push and dispatch` (`test/pipeline-outcomes-897.test.mjs`); реплей подлинных артефактов #957 из комментария автора | Разобрано чтением, не исполнением: без `repo` в `expected` (поведение до фикса) `passport.repo` в фикстурах `policyEvidence()` не задан → `identity()` в `review-findings-policy.mjs:23-27` требует `typeof repo === 'string'` → `readFindingsPolicy` бросает `findings policy: invalid review identity`, что ровно совпадает с наблюдаемой ошибкой из issue. Патч исполняемой реализации/мутант не прогонялся — это запрещено вне ночного workflow (#905) |
| AC2 (policy/seal/companion/continuation guards сохранены; чужой repo/issue/stage/round/path/source, corrupt JSON, лишний/пустой/отсутствующий companion, битый manifest/hash, другой epoch/body/material — fail-closed; pre-#926 issues-протокол не сломан) | `#961 trusted controller repo defeats foreign policy even with self-consistent resealed artifacts`; `#961 current policy never bypasses result seal, companion or exact epoch/body/material guards`; старый `#897 AC1 corrupt/incomplete/foreign result...` | Обычные отрицательные случаи на неизменённой реализации, исполнены: `node --test test/pipeline-outcomes-897.test.mjs` — все throw/reject-проверки red→green подтверждены прогоном (26/26 pass, см. ниже) |
| AC3 (настоящий `process-resume.mjs` CLI на Linux, offline API-фикстура: valid → exit 0 `applied=false`, corrupted/forged → nonzero, без write API/relabel/dispatch) | `#897/#961 actual resume CLI: legacy/issues/file policy exits zero only for verified receipts, no writes` | Та же проверка, обычный отрицательный случай (битый seal после записи `review-document.md`, подделанный `repo` в `prepared.json`+`findings_policy_snapshot` с пересчитанными checksum) — исполнена в составе прогона |

## Что проверено исполнением

- `node --test test/pipeline-outcomes-897.test.mjs test/process-resume.test.mjs test/review-findings-policy.test.mjs` → **26/26 pass**, 0 fail/skip (включая реальный CLI-спавн `process-resume.mjs` на офлайн-фикстуре с поддельным `gh`/`git`). Совпадает с заявленным автором числом.
- `node --test test/process-digests.test.mjs` → 10/10 pass (текстовые ссылки/якоря `REVIEWER.md`/`DEVELOPMENT.md` не нарушены правкой документации).
- `node --test test/release-ledger.test.mjs` → 6/6 pass (новый `961.json` не ломает схему/контракт реестра).
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` → `noExecutableDiff: true`.
- `git diff --check origin/dev...HEAD` → чисто, без whitespace-ошибок.

## Что не проверялось и почему

- `npx tsc --noEmit`, `npm test` (полный), `npm run build` + сверка трёх копий бандла — не перегонялись: Validate на этом же SHA `fbd500798` зелёный ([run 39215232892](https://github.com/Matysh/houseplan-card/actions/runs/39215232892)), это допустимо по §8/#343. Диапазон правок не содержит кода бандла, что подтверждает `noExecutableDiff`.
- Браузерные смоки и `golden:verify` — не запускались: нет исполняемого (рендер/UI) диффа, меток `ci:golden`/`ci:windows-native` нет, тело issue не называет смок.
- `pytest tests_backend` — не запускался: Python не затронут.
- Инварианты модели (`npm run invariants`) — не применимо: геометрия плана не затронута.
- Повторный живой прогон `process-resume.yml`/`process-reconcile.yml` на GitHub Actions (сетевой, против реального `gh api`) — не выполнялся; это штатно вне ревью, доказательство — офлайн CLI-фикстура (AC3) плюс заявленный автором read-only реплей подлинных артефактов #957.
- Мутант в `scripts/mutation-registry.mjs` не заводился и не требуется: защита живёт в чистом unit-скрипте процесса, не в продуктовом коде за дорогим гейтом (§2.7) — для неё достаточно отрицательного случая в самом тесте, что и сделано.
- Временный ручной патч `scripts/process-resume.mjs` (откат фикса) с последующим прогоном теста не выполнялся — это исполнение мутанта продуктового/исполняемого кода, запрещённое вне ночного workflow даже ревьюеру (#905). Регрессия подтверждена чтением кода (см. таблицу выше), а не исполнением старой версии.

## Трейлеры, changelog, release ledger

- Коммит `fbd500798`: `Issue: #961`, `User-Visible: no` — верно, правка не меняет видимое поведение (чинит внутренний процесс ревью/мерджа).
- `User-Visible: no` ⇒ правка changelog RU/EN не требуется и не делается — корректно.
- `docs/release-ledger/v1.81.0/961.json`: `category: "infra"`, обоснование относительно `v1.81.0` присутствует и по существу («Bind resumed sealed review findings to the trusted controller repository... no product changes»). Совпадает по шаблону с соседними process-инфра записями того же цикла (`957.json`, `960.json`). `introducedBy` не требуется (нужен только для `line-fix`). `isUserReleaseEntry` для `infra` — `false`, задача корректно не попадает в пользовательский milestone релиза.
- Видимых пользователю чисел, дублирующихся в диффе, нет (внутренний инфра-фикс, нет UI-значений).

## Маршрут §726 / критерии §5 (трек show)

- `complexity` ≤ 3 — да, точечная однострочная правка с комментарием, локализованная в одной функции.
- `surfaces` — одна поверхность: `resumeEvidence` в `scripts/process-resume.mjs`.
- `migration` — нет новых полей конфигурации/совместимости.
- `ux-contract` — нет нового UX-контракта, поведение непубличное (process-инфраструктура).
- `perf-touch` — не затронуто.
- `undocumented` — ожидаемое поведение уже зафиксировано: тот же принцип «repo — authority контроллера, не поле артефакта» уже реализован и задокументирован для соседнего пути проверки (`review-result-gate.mjs` CLI, `expected.repo = process.env.REPO`); фикс приводит `resumeEvidence` к тому же канону, а не вводит новый контракт.

Все критерии §5 пройдены → `route: fix`.

## Находки

Нет. Диапазон коммитов минимален, соответствует описанному в issue AC1–AC3, тесты исполняются и умеют падать (доказано чтением для регрессионного сценария, исполнением — для guard-сценариев), документация и release-ledger согласованы с кодом.

Побочных находок нет (mode=issues — новых issue не заводится).

## Вердикт

Зелёный. AC1–AC3 выполнены и доказаны; минимальный точечный фикс без побочных эффектов на соседние пути проверки; гейты, применимые к диапазону правок, зелёные.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/961-sealed-green-resume`, коммит `fbd500798e78` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `81d1792e167adaa7f7f91cc5f6f11a04222a8f88`
  ```
  git log --all --format='%H %T' | grep 81d1792e167a
  ```
- Тело issue: `d9ec3ec02d5fbf63ee25c8f74cfb86928bf4de724e6318ae49cad2694cdaa466`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxODksIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjc5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Niwib3V0cHV0X3Rva2VucyI6MTk2ODgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODI2MTMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMTM3MTQ1LCJjb3N0VXNkRXN0aW1hdGUiOjAuOTU0ODczMDAwMDAwMDAwMX1dLCJ0dXJucyI6MzUsImR1cmF0aW9uTXMiOjI0OTQ0MCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTYwMTUyMDAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5245 output_tokens=19706 cache_creation_input_tokens=82613 cache_read_input_tokens=2137145 num_turns=35 -->
