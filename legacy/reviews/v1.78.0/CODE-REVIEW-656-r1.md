# CODE-REVIEW — issue #656, заход r1

## Материал раунда

- SHA материала: `43fab645b0d07a5ead78341ebca5f788db13a0fc` (ветка `issue/656-release-proof`), ровно один коммит поверх `origin/dev`.
- Validate на этом SHA: green — https://github.com/Matysh/houseplan-card/actions/runs/36225639293.
- Класс изменений: B (`scripts/ci-proof.mjs`, `scripts/release-gate.mjs`, `.github/workflows/performance.yml`, `test/**`) + C (`PROCESS.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`). Класса A нет — инфраструктурная задача, вход сразу на `S7-code-review` подтверждён.
- Трейлеры коммита: `Issue: #656`, `User-Visible: no` — присутствуют и верны (изменение не видимо пользователю продукта).

## Скоуп

Issue описывает два инцидента аудита 26.09 и просит по ним 4 пункта в разделе «Ожидается»:

1. Зафиксировать и реализовать политику proof (fail-open → fail-closed) — вариант (а) или (б), с тестами на оба случая.
2. Починить/обойти красный Validate на `main` до промоушена 1.78.0.
3. Сухой прогон `scripts/release-gate.mjs` на SHA кандидата 1.78.0 с результатом в issue до промоушена.
4. `performance.yml`: `paths-ignore` для `.github/workflows/**` и `docs/**`.

Материал этого коммита закрывает **пункты 1 и 4**. Пункты 2 и 3 в диффе отсутствуют — см. «Открытые пункты» ниже; это не дефект кода под ревью, а разбор того, что именно доказано этим коммитом.

## Как проверялось

Дешёвые гейты (typecheck/test/build) подтверждены зелёным Validate на этом SHA — не перегонял. Диф не трогает `src/**`, поэтому `check-docs.mjs` не требуется. Дополнительно прогнал целевые проверки и мутационную проверку «тест умеет падать»:

| Гейт | Прогнан | Результат |
|---|---|---|
| Validate (typecheck/test/build/docs/provenance/process-gate) | нет, зачтён по зелёной ссылке на этот SHA | green |
| `node --test test/ci-proof.test.mjs test/release-gate.test.mjs` | да | 31/31 green |
| `node --test test/performance-workflow.test.mjs` | да | 6/6 green |
| `node scripts/smoke-select.mjs --base HEAD~1 --head HEAD` | да | «Browser-smoke этим диффом не выбираются» — нет `src/**` в диффе, смоки не нужны |
| Мутация: откат `scripts/ci-proof.mjs` + `scripts/release-gate.mjs` к родителю (`9287f798`), тесты того же файла | да | ключевой тест `#656: a newer failed full proof blocks an older green proof on the exact SHA` красный (`'green' !== 'failed'`), остальные 29/31 green |
| Мутация: откат `.github/workflows/performance.yml` к родителю | да | `test/performance-workflow.test.mjs` 5/6 green, 1 fail (искомая строка `paths-ignore` отсутствует) |
| `golden:verify`, `pytest tests_backend`, `npm run invariants`, performance-профили | нет | диф не меняет `src/**`, Python, геометрию; в AC не названы |
| `node scripts/check-docs.mjs` | нет | диф не трогает `src/**` |

Рабочая копия после обеих мутационных проверок восстановлена до состояния коммита (`git status --short` — чисто), файлы правились только временно для проверки и возвращены.

## AC · чем доказан · чем краснеет (защитные AC)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| Среди совместимых **полных** Validate-прогонов на одном SHA решает новейший: поздний `failed`/`missing`/`pending` блокирует более ранний зелёный | `test/release-gate.test.mjs`: «#656: a newer failed full proof blocks an older green proof on the exact SHA» | Мутация — откат `ci-proof.mjs`/`release-gate.mjs` к родительскому коммиту: тест краснеет, возвращая `green` вместо ожидаемого `failed` (проверено мной прогоном, см. таблицу выше) |
| `light`/`stale`/`cancelled` прогон не вытесняет более раннее совместимое доказательство | `test/release-gate.test.mjs`: «#656: a newer failed light proof cannot hide an older compatible green proof»; `test/ci-proof.test.mjs`: «#656 AC: newest compatible full proof decides; light proofs do not» | Та же мутация — на старом коде эти тесты уже проходили (это старое поведение #541/#511), различие видно на первом ряду таблицы; сам новый тест дополнительно проверен на актуальном коде (green) |
| Новый полный зелёный прогон обновляет старый красный | `test/release-gate.test.mjs`: «#541: a later complete full proof refreshes an older red release candidate» | Существовавший тест, поведение не менялось этим коммитом — проверено чтением, не мутировал повторно |
| `performance.yml` не запускает полные бенчмарки на push в `main`, тронувший только `.github/workflows/**`/`docs/**` | `test/performance-workflow.test.mjs` проверяет наличие `paths-ignore` в YAML под `push:` | Мутация — откат `performance.yml` к родителю: тест краснеет (1 fail из 6), проверено мной прогоном |

Пустых третьих столбцов нет.

## Что проверено и корректно

- **Логика `classifyValidateProofs` (`scripts/release-gate.mjs:56-86`)**: прогоны читаются от нового к старому (`newestFirst`), цикл продолжает сквозь `cancelled`/`stale` и останавливается на первом «решающем» статусе (`green`/`failed`/`missing`/`pending`), после чего `selectCiProofVerdict` (`scripts/ci-proof.mjs:442-448`) просто берёт первый нецензурированный элемент. Разобрал построчно и мысленно прогнал сценарий из инцидента («зелёный push + красный `workflow_dispatch` на том же дереве») — новый код возвращает `failed`, старый возвращал `green`; воспроизвёл это прогоном (см. мутацию выше), а не только чтением.
- **Стабильность набора job между повторными прогонами одного SHA**: `selection` (`backend`/`geometry_parity`/…) в `validate.yml` считается через `git merge-base origin/dev "$HEAD_SHA"` (`.github/workflows/validate.yml:318`) — для фиксированного кандидата на `dev` merge-base не плывёт при повторных прогонах, то есть «набор запрошенных job» между двумя полными прогонами одного SHA не может разойтись за счёт дрейфа диффа. Проверено чтением, не исполнением — вариант (а) из issue («разница в наборе job» как исключение) поэтому корректно свёрнут к единственной практически значимой оси — `full`/`light` (через `policy.full`), отдельного сравнения списков не требуется.
- **`review`/`merge` не затронуты и не должны быть**: `scripts/validate-gate.mjs` и `scripts/merge-candidate.mjs` вызывают `evaluateCiProof` на одном конкретном (только что продиспатченном) прогоне, а не сканируют историю через `classifyValidateProofs`/`selectCiProofVerdict` — семантика #541 для них действительно не меняется, как заявлено в `docs/DEVELOPMENT.md`.
- **Документация — одно число, один источник**: `PROCESS.md` §11.6 (новый раздел), `docs/DEVELOPMENT.md:624-630` и `docs/STATUS.md` (строка CI) описывают правило одинаковыми словами («newest compatible full run… a later failed full run blocks an older green proof… a later complete green full run can refresh an older failure»); проверил `grep` по репозиторию — старая формулировка «any complete green full proof… is sufficient» нигде больше не осталась активной (только в архивных `docs/reviews/CODE-REVIEW-619-r1.md`, что законно — исторический документ прошлого раунда). Тест `test/release-gate.test.mjs` («#541: the release documents describe proof semantics») сверяет актуальность текста `docs/DEVELOPMENT.md` с кодом.
- **`performance.yml`** (`.github/workflows/performance.yml:6-11`): `paths-ignore` вложен корректно — только под `push`, не затрагивает `schedule`/`workflow_dispatch`, так что еженедельный и ручной прогоны не теряются. Реальный промоушен-коммит в `main` (version fields, `dist/**`, `CHANGELOG*`, по «Promotion rule» AGENTS.md) не попадает под `.github/workflows/**`/`docs/**`, поэтому Full Performance по-прежнему запустится на настоящем кандидате — паттерн не рискует молча пропустить нужный прогон.
- Тесты `test/ci-proof.test.mjs`/`test/release-gate.test.mjs` переименованы и переписаны так, что старые формулировки (`#619: … survives a newer failed duplicate`) заменены на противоположное по смыслу утверждение (`#656: … blocks …`) — это осознанная смена контракта, а не тихая правка ожидания; в отличие от «правки теста, чтобы он перестал падать», здесь меняется сама политика, зафиксированная в PROCESS.md, и это прослеживается по issue.

## Находки

Пусто — блокирующих (High) и находок Medium в скоупе нет.

## Открытые пункты (не находки, для протокола)

Issue перечисляет 4 пункта «Ожидается»; этот коммит закрывает 1 и 4. Пункты 2 (красный Validate на `main`) и 3 (сухой прогон `release-gate.mjs` на кандидате 1.78.0, запись в issue) в материале отсутствуют:

- Оба пункта в тексте issue явно привязаны к моменту «до промоушена» stable-релиза, а не к этому коммиту. На дереве уже есть беты `v1.78.0-beta.1..3`, стабильного тега ещё нет — то есть кандидат-SHA для пункта 3 пока не выбран, прогонять дословно нечего.
- Пункт 2 сам называет допустимым решением «промоушен вскоре после починки п.1» (после fast-forward `main` унаследует текущий `action-pins.mjs`/тесты из `dev`, и красный уйдёт сам) — это операционное решение владельца о релизе, не код этой задачи.
- Ни то ни другое не меняет вердикт по коду, который здесь под ревью: это не Medium «в скоупе» (нечего чинить кодом сейчас) и не Medium «вне скоупа» (не посторонний дефект — это тот же issue, следующий шаг которого явно назначен на другое время). Фиксирую это здесь, чтобы «оставили в тексте ревью» не выглядело как основание не возвращаться к пунктам 2/3 — они остаются в issue #656 до его закрытия (батч на релизе, не на этом код-ревью).

## Чего не проверял

- Живой прогон `scripts/release-gate.mjs`/`waitForGreenWorkflow` против настоящего GitHub API — код проверен модульными тестами (fixtures), не end-to-end диспетчем; это соответствует объёму гейтов задачи такого размера.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`, performance-профили — не прогонял, диф не трогает `src/**`, Python-бэкенд или геометрию, и ни один из них не назван в AC.
- Пункты 2 и 3 из «Ожидается» — не проверял по существу (см. «Открытые пункты»): для пункта 3 попросту нет ещё кандидата, для пункта 2 нет назначенной даты промоушена в материале.
- Ручное тестирование UI — не применимо, изменение не пользовательское (CI/процесс).

## Вердикт

Зелёный. Пункт 1 (fail-closed политика) и пункт 4 (`performance.yml` `paths-ignore`) реализованы полно, тесты доказывают AC и умеют падать (проверено мутацией на обоих затронутых гейтах), документация синхронна (PROCESS.md/DEVELOPMENT.md/STATUS.md — одна формулировка, один источник). Пункты 2 и 3 не входят в этот коммит по замыслу самого issue (действия «до промоушена», а не код этой задачи) и не образуют находку.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/656-release-proof`, коммит `43fab645b0d0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `34573345f65403cf240cd945b7662dd2aca74191`
  ```
  git log --all --format='%H %T' | grep 34573345f654
  ```
- Тело issue: `e72159f00e412e8dea5068bb2bb071a621ee0c4fc029c67aef1d67d71249b297`
- Вердикт конвейера: `green` · High 0
