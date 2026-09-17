# CODE-REVIEW-573-r1

**Issue:** #573 — Release proof: переиспользовать проверки product tree после
baseline-only commit без второго полного Validate
**Трек:** infrastructure (класс B/tests/process, класса A нет)
**Материал:** `47f36e571c723ee163bb10dc44a31582b5e9e5fc` (единственный коммит на
`issue/573-release-proof-reuse`, база `origin/dev` = `06bf9b69`)
**Заход:** r1 · блокирующих циклов израсходовано (до этого раунда) 0 из 4

## Скоуп

Proof Validate до этой задачи называл только `tree` кандидата. Приёмка
эталонов (`ad4000f9` на beta.3) меняла его целиком, хотя продукт не менялся —
второй Validate честно перегонял smoke/perf/6 шардов мутантов, которые уже
были доказаны первым прогоном. Причина: `source-fingerprint.mjs` называет
корпус строкой-каталогом `demo/golden`, а замыкание входов раскрывало эту
строку во все текстовые файлы под каталогом, включая
`demo/golden/baselines/baselines-index.json` — индекс эталонов утекал во
входы smoke/perf/browser-guard мутантов.

Правка вводит:
1. `BASELINE_OVERLAY` в `check-inputs.mjs` — раскрытие каталога по строке
   больше не выдаёт overlay эталонов; явный корень (`golden`) и явная ссылка
   на файл — как были.
2. Составное evidence в proof (`ci-proof.mjs`): `product.tree` (ls-tree без
   overlay), `baselines.{tree,manifestSha256,reviewedRun}`, `keys` (content-
   ключи пяти реюзных job, включая исполненные).
3. `evaluateCiProof({expected, reviewedRun})` — потребитель на checkout
   кандидата сверяет evidence, а не верит ему; `release-gate.mjs`/
   `release-prerelease.mjs` считают `expected` только когда `HEAD == sha`.

Класса A нет, `User-Visible: no` корректен, трейлеры (`Issue: #573`,
`User-Visible: no`) на месте.

## Как проверялось

Дешёвые гейты (`typecheck`, `npm test`, `npm run build`, `check-docs`) на этом
SHA уже подтверждены зелёным Validate (run 35262504454, https://github.com/Matysh/houseplan-card/actions/runs/35262504454) —
не перегонял.

Сам прогнал (диф не трогает `src/**`, геометрию, рендер — полные наборы не
нужны):

| Гейт | Команда | Результат |
|---|---|---|
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет … Browser-smoke этим диффом не выбираются» — смоки не нужны, диф не трогает `src/**` |
| Покрытие входов | `node scripts/check-inputs.mjs --coverage` | чисто, 0 неизвестных |
| Заявленное поведение фикса | `node scripts/check-inputs.mjs --check=smoke --why=demo/golden/baselines/baselines-index.json` | «не вход smoke» — воспроизвёл ключевую заявку автора вживую |
| Целевые unit-тесты задачи | `node --test --test-name-pattern="#573" test/check-inputs.test.mjs test/gate-reuse.test.mjs test/mutation-gate.test.mjs test/ci-proof.test.mjs test/release-gate.test.mjs` | 11/11 pass |
| «Тест умеет падать» для AC1/защиты overlay | вручную откатил фильтр `!isBaselineOverlay(f)` в `check-inputs.mjs`, перегнал те же 4 файла | все 4 упали (например `mutation-gate.test.mjs`: отпечаток свидетеля со смок-гардом изменился — ожидаемое поведение до фикса), затем восстановил файл, `git diff` чист |
| Инварианты геометрии | — | не нужны: диф не трогает рёбра/толщину/`layout` |
| golden/pytest/perf | — | не нужны: диф не трогает рендер и `custom_components/**/*.py` |

Не прогонял: `npx tsc --noEmit`, `npm test` (полный), `npm run build`,
`node scripts/check-docs.mjs` целиком — покрыты зелёным Validate на этом SHA.

## AC → доказательство → чем краснеет

| # (из тела issue) | Доказан | Чем краснеет |
|---|---|---|
| 1. beta.3-воспроизведение: baseline-only commit reuses green, golden перегоняется, final proof green | `test/ci-proof.test.mjs` `#573 AC1`; `test/gate-reuse.test.mjs` `#573` (синтетика C→B); реальная пара `e5fe4364→ad4000f9` в комментарии автора | мутант `baseline-overlay-leaks-into-every-key` (проверено лично, см. таблицу выше — 4/4 теста падают на откате фильтра) |
| 2. source+baseline вместе → соответствующие job исполняются | `test/gate-reuse.test.mjs` `#573` (правка `src/card.ts` вместе с эталонами меняет ключи smoke/golden/perf) | тот же мутант (ключи перестают различать источники) |
| 3. красный smoke/mutant/perf не прячется зелёной golden | `test/ci-proof.test.mjs` `#573 AC3` | контракт #541 (`reuse-*` мутанты, не менялся в этой задаче) |
| 4. подмена ключа/tree/индекса/reviewed-run → fail-closed | `test/ci-proof.test.mjs` `#573 AC4`; `test/release-gate.test.mjs` `#573` | мутанты `proof-trusts-evidence-it-could-verify`, `reused-marker-key-unchecked-against-candidate`, `product-tree-identity-counts-baselines` — прочитаны, патчи соответствуют текущим строкам кода (проверено чтением, не переисполнял мутацию вручную — они уже отчитаны Validate как «поймано 1 из 1») |
| 5. один terminal contract для release/merge/review | частично доказан — см. находку Medium ниже: реальный вызов `evaluateCiProof` из `merge-candidate.mjs`/`validate-gate.mjs` с настоящим `reviewedRun`-объектом не покрыт тестом, а поведение фактически новое | — |
| 6. замер wall time | оценка автора по факту длительностей job прогона `ad4000f9` (не тест, честно оформлено как оценка, issue не требовал автотеста) | н/п |

## Находки

### Medium (в скоупе — правится в этой же задаче)

**`evaluateCiProof` меняет поведение merge/review-потребителей без теста и
вопреки утверждению автора, что оно не меняется.**

- **Файл:** `scripts/ci-proof.mjs`, блок `evaluateCiProof` (строки 297–311),
  фактически задействован через `scripts/merge-candidate.mjs` (line ~164) и
  `scripts/validate-gate.mjs` (line ~77) — оба используют
  `loadGithubProofContext`, которая теперь возвращает `reviewedRun`.
- **Суть:** блок проверки `Baseline-Reviewed` run (существует/завершён/не
  отменён/принадлежит `validate.yml`) срабатывает всегда, когда
  `proof.evidence.baselines.reviewedRun` объявлен — независимо от того,
  передан ли `expected`/`policy.full`. Он не привязан к release: любой
  консьюмер (`merge`, `review`), которому `loadGithubProofContext` вернула
  реальный (не `undefined`) `reviewedRun`, получает новую fail-closed
  проверку.
- **Это не гипотетика.** Ровно такой коммит — исполнитель принимает эталоны
  той же веткой, что и правку, с трейлером `Baseline-Reviewed:` на верхушке —
  уже стандартная практика этого репозитория: `9bf41ec3` (`#584`,
  непосредственно предыдущая задача, слитая перед этой) сделан именно так и
  прошёл текущий S7/merge. После этой задачи такой коммит на верхушке ветки
  заставит `merge-candidate.mjs` и `validate-gate.mjs` (тот самый гейт, что
  прямо сейчас ждёт Validate для код-ревью!) дополнительно зависеть от
  доступности GitHub API для СТАРОГО run'а, названного трейлером, — сбой
  этого запроса (см. `catch { reviewedRun = null; }` в
  `loadGithubProofContext`) закрывает merge/review `failed`, хотя раньше они
  этот run вообще не проверяли.
- **Воспроизвёл лично:**
  ```js
  evaluateCiProof({ run, proof /* proof.evidence.baselines.reviewedRun: 999 */,
    jobs, candidate, policy: CI_PROOF_POLICIES.merge, reviewedRun: null })
  // → { status: 'failed', note: 'Baseline-Reviewed run 999 is missing, cancelled or not a Validate run' }
  ```
  притом что `expected` не передавался вовсе — то есть это не «сверка
  ожиданий release-потребителя», а самостоятельная новая проверка, которая
  молча зацепила merge/review.
- **Не покрыто тестами:** единственный тест с `policy: CI_PROOF_POLICIES.merge`
  (`test/ci-proof.test.mjs:266`) явно передаёт `reviewedRun: undefined`,
  обходя именно этот путь. Ни в `test/merge-candidate.test.mjs`, ни в
  `test/validate-gate.test.mjs` нет ни одного упоминания `reviewedRun` —
  реальный вызов через `loadGithubProofContext` не проверен ни разу.
- **Расходится с хендоффом:** автор пишет «Review/merge-потребители
  получают тот же evaluate без ожиданий — их семантика не меняется». Это
  верно только для сверки `expected` (product tree/keys/overlay); проверка
  `reviewedRun` — новая для этих потребителей и от `expected` не зависит.
- **Почему Medium, не High:** направление отказа безопасное (fail-closed, не
  скрывает дефект), и для ЭТОЙ задачи не проявляется (у `47f36e57` нет
  `Baseline-Reviewed`). Риск — будущая спурная поломка merge/review на
  легитимном сценарии (баг-фикс + приёмка эталонов одной веткой), без единого
  теста, который поймал бы регресс в любую сторону.
- **Предлагаемое устранение (на выбор автора):** либо ограничить проверку
  `reviewedRun` тем же условием, что и `expected` (реально нужна только
  release-потребителю, который заявлен как единственный, кто про это
  спрашивает), либо добавить тест на `merge`/`review` policy с настоящим
  объектом `reviewedRun` (успех и отказ) и явно принять новое поведение,
  поправив формулировку в хендоффе.

## Что проверено и корректно

- `BASELINE_OVERLAY`/`isBaselineOverlay`/`closure` — воспроизвёл вживую и
  мутацией; overlay больше не течёт через раскрытие каталога, явная ссылка на
  файл (`test/golden-index.test.mjs`-подобный сценарий) остаётся входом.
- `CHECKS.golden.roots` содержит `demo/golden/**` явным корнем — golden
  по-прежнему видит overlay напрямую, не через закрытие; заявка «golden не
  теряет эталоны» подтверждена чтением.
- `productTreeId`/`baselineReviewedRun` — детерминированные чистые функции,
  тесты покрывают приёмку эталонов (дерево не меняется) и правку исходника
  (дерево меняется), throws на пустом дереве и на трейлере без run id.
- `buildCiProof` пишет `key` для исполненной реюзной job и отвергает чужой
  ключ маркера реюза — проверено тестом и логикой (симметрично записи и
  сверке).
- `candidateExpectations` считает evidence только когда `HEAD == sha`, иначе
  явный notice «проверяю по GitHub» — корректно ограничивает применимость
  локального сравнения только собственным checkout'ом.
- Golden-гарды мутации (`golden-lamp-out-of-reach`,
  `golden-filled-tunnel-removed`) — проверил чтением: оба в `--mode=capture`
  по семантическим ассертам, `demo/golden/policy.mjs` запрещает verify по
  одной сцене, так что потеря overlay в их отпечатке не открывает дыру.
- Документация (`DEVELOPMENT.md`, `TESTING.md`, `STATUS.md`) описывает именно
  то поведение, что в коде — сверил построчно.
- `reviewedRun`-проверка НЕ проверяет `conclusion === 'success'`, только
  «не cancelled» — согласуется с самим сценарием beta.3, где просматриваемый
  run был красным по golden; намеренно, не дефект.

## Чего не проверял

- Полный `npm test`/`npm run typecheck`/`npm run build` — покрыты зелёным
  Validate на этом SHA, не перегонял.
- `check-docs.mjs` целиком — то же самое, плюс диф не трогает `src/**`.
- Реальный прогон Validate с настоящим `NEEDS_JSON`/`reuse.outputs` (job
  `proof` в CI) — верю логике и юнит-тестам, живой YAML не выполнял.
- Мутанты `proof-trusts-evidence-it-could-verify`,
  `reused-marker-key-unchecked-against-candidate`,
  `product-tree-identity-counts-baselines` — сверил патчи с текущим кодом
  построчно (совпадают), но не переисполнял их вручную (в отличие от
  `baseline-overlay-leaks-into-every-key`, который проверил лично);
  полагаюсь на отчёт Validate «поймано 1 из 1».

## Итог

Ядро задачи (overlay не течёт в ключи smoke/perf/мутантов, golden видит
overlay явным корнем, release-потребитель сверяет evidence и fail-closed на
подмену) реализовано корректно и доказано тестами, которые я лично убедился,
что умеют падать. Один Medium-дефект в скоупе: новая fail-closed проверка
`Baseline-Reviewed` run зацепила merge/review-потребителей незаметно для
автора и без единого теста на этом пути, при уже существующем в репозитории
прецеденте (`#584`), который его бы затронул. High-находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/573-release-proof-reuse`, коммит `47f36e571c72` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `aca987ffcc31c3656ec79fea04db2890c9f2242a`
  ```
  git log --all --format='%H %T' | grep aca987ffcc31
  ```
- Тело issue: `5ab99e532f34bdfa488c9143f2c1c1361b826159e0707a56ce70a640e8ca4fff`
- Вердикт конвейера: `yellow` · High 0
