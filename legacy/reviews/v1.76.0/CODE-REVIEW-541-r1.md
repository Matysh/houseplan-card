# CODE-REVIEW-541-r1

Issue: #541 · «Один общий доказуемый CI-контракт для review/merge/release»
Трек: инфраструктурный (класс B/C, вход сразу на S7-code-review, решение владельца 13.09.2026)
Материал ревью: `0fd6977b47d6801b5bb8e6943188e3d7291f20b8` (рабочая копия уже на нём)
Заход: r1 · блокирующих циклов израсходовано 0 из 4

## Скоуп

Диапазон `origin/dev..HEAD`, 4 коммита, 17 файлов:

```
.github/workflows/validate.yml  |  93 +++
docs/DEVELOPMENT.md             |  15 +-
docs/STATUS.md                  |   2 +-
docs/TESTING.md                 |   6 +-
scripts/check-inputs.mjs        |   3 +-
scripts/ci-proof.mjs            | 339 +++ (новый)
scripts/merge-candidate.mjs     |  40 +-
scripts/mutation-gate.mjs       |  61 +-
scripts/release-gate.mjs        |  58 +-
scripts/release-prerelease.mjs  |  20 +-
scripts/validate-gate.mjs       |  41 +-
test/check-inputs.test.mjs      |  11 +-
test/ci-proof.test.mjs          | 190 +++ (новый)
test/merge-candidate.test.mjs   |  84 +-
test/release-gate.test.mjs      |  71 +-
test/validate-gate.test.mjs     |  31 +-
test/validate-workflow.test.mjs |  36 +
```

Все файлы — классы B (гейты/скрипты/workflow/тесты) и C (документация). Ни
одного файла класса A (`src/**`, `custom_components/**/*.py`) — задача
действительно инфраструктурная, полный флоу S1–S6 законно пропущен по §1.
Трейлеры всех четырёх коммитов: `Issue: #541` · `User-Visible: no` — верно для
чисто процессного изменения без пользовательского поведения.

Задача реализует единый машинно-проверяемый артефакт `ci-proof-<run>-<attempt>`
(`houseplan-ci-proof/v1`) и одну функцию состояний (`green/missing/pending/
cancelled/stale/failed`), которую разделяют review (`validate-gate.mjs`), merge
(`merge-candidate.mjs`) и release (`release-gate.mjs`/`release-prerelease.mjs`),
закрывая аудиторскую находку N2 §10: лёгкий зелёный dispatch мог заменить
старый красный full-прогон, а зелёный dispatch без исполненных mutant-job
проходил как доказательство для merge.

## Как проверялось

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit`, `npm test` (полный), `npm run build` + сверка бандла | не гонял повторно | Validate зелёный на точном SHA `0fd6977b`: https://github.com/Matysh/houseplan-card/actions/runs/34744556987 (подтверждено условием ревью — «дешёвые гейты на этом SHA уже подтверждены») |
| `node --test test/ci-proof.test.mjs test/merge-candidate.test.mjs test/release-gate.test.mjs test/validate-gate.test.mjs test/validate-workflow.test.mjs test/check-inputs.test.mjs` | **прогнал сам** | 75/75 green |
| `node scripts/process-gate.mjs` (офлайн, без `--issues`) | **прогнал сам** | «гейт пройден, предупреждений 0» |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнал сам** | «Исполняемого frontend-диффа нет» — браузерные смоки нечего выбирать, `src/**/*.ts` не тронут |
| `node scripts/check-docs.mjs` | не гонял | не применимо: diff не трогает `src/**` |
| `npm run golden:verify` | не гонял | не применимо: нет визуальных изменений |
| `node scripts/model-invariants.mjs` | не гонял | не применимо: геометрия/`layout`/толщины не затронуты |
| `python -m pytest tests_backend -q` | не гонял | не применимо: ни один `custom_components/**/*.py` не тронут |
| YAML-синтаксис `validate.yml` | **прогнал сам** | `python3 -c "import yaml; yaml.safe_load(open(...))"` — parses OK |
| Байтовая длина имён job (риск усечения GitHub Jobs API >100 UTF-8 байт, дважды ловился на этой же ветке) | **прогнал сам** | все резолвленные имена ≤112 байт максимум («Мутанты по диффу (1/6)…» = 94, «Доказательство выполненных проверок» = 68) — то же, что уже проверяет `test/validate-workflow.test.mjs` для `preflight` |
| `grep` job-графа `needs:` proof-job против списка реальных job id в workflow | **прогнал сам** | все 12 зависимостей существуют, ничего не рассинхронизировано |

### Защитные AC — таблица «чем краснеет»

Все три — новый защитный код в `scripts/ci-proof.mjs`, чистые юниты. Мутировал руками (patch → прогон → откат), дополнительно у трёх из них есть штатные witness в `scripts/mutation-gate.mjs`, которые я тоже прогнал по отдельности (`node scripts/mutation-gate.mjs --id=<id>`).

| AC (issue #541) | Чем доказан | Чем краснеет |
|---|---|---|
| Rebase/смена run attempt не переносит старое доказательство новому кандидату (проверка `proof.run.attempt !== expected.attempt`) | `node --test test/ci-proof.test.mjs` (тест «SHA, tree, run attempt, event… cannot drift») | Снял только часть условия про `attempt` (`\|\| false && proof.run?.attempt !== expected.attempt`) — тест покраснел (1 fail из 8). Восстановлено, `git status` чист |
| Лёгкий зелёный run не проходит как full для release (`policy?.full && !asBool(proof.request?.full)`) | `node scripts/mutation-gate.mjs --id=release-proof-accepts-light-run` (witness: `test/ci-proof.test.mjs` + `test/release-gate.test.mjs`) | «release-proof-accepts-light-run: тест покраснел, как обязан» |
| Зелёный dispatch без реально доказанных mutant-job не проходит review/merge (`policy?.mutants && !asBool(proof.request?.mutants)`) | Ручная мутация той же строки | 1 fail в `test/validate-gate.test.mjs` («a green foreign dispatch whose mutant jobs were skipped is ignored»). Отдельного witness в `mutation-gate.mjs` для этой строки нет, но существующий unit-тест (унаследован от #510) реально её защищает |
| Reuse без независимо проверенной зелёной source-job не принимается (`!source \|\| … \|\| !executedCheckIsGreen(id, source.jobs)`) | `node scripts/mutation-gate.mjs --id=ci-proof-trusts-reuse-without-source-job` | «тест покраснел, как обязан» |
| Merge не принимает success-conclusion без proof-артефакта (`!proof` → `missing`, не `green`) | `node scripts/mutation-gate.mjs --id=merge-trusts-success-without-proof` | «тест покраснел, как обязан» |
| Красный dispatch / отменённый dispatch не проходят review (унаследованные из #510 проверки, переехавшие в `ci-proof.mjs`) | `node scripts/mutation-gate.mjs --id=review-starts-on-red-validate` и `--id=review-returns-task-on-cancelled-dispatch` | оба «тест покраснел, как обязан» |

Все шесть прогонов мутации выполнил лично, рабочее дерево после каждого чистое
(`git status --short` пусто).

## Разбор по AC issue (раздел «Приёмка»)

1. **«Full red → light green не разрешает release; настоящий full green после старого red разрешает»** — `test/release-gate.test.mjs`: «release skips a newer light proof but does not let it hide an older full failure» и «a later complete full proof refreshes an older red release candidate», оба green. Прочитано и логику `classifyValidateProofs`/`selectCiProofVerdict` — идут от новейшего run к старому, пропуская `cancelled`/`stale`, первый решительный статус — вердикт.
2. **«Dispatch без реально доказанных mutant jobs не разрешает merge»** — `test/ci-proof.test.mjs` («green dispatch without six executed mutant jobs proves neither review nor merge») и `test/merge-candidate.test.mjs` («real merge waiter never accepts a successful dispatch without its proof artifact») — оба green; независимая проверка `executedCheckIsGreen` берёт реальный список job из GitHub API, а не то, что заявляет сам proof.
3. **«Законное content-addressed reuse принимается только с полными доказательствами»** — тест «reuse needs a content key, marker source SHA/run and the successful source job» проверяет три угла: пустой `reuseRuns` → failed, испорченный `key` → failed, но легитимный reuse на источник с посторонним красным job (сам overall run красный, но конкретная job зелёная) — принимается (это явно документированное поведение, не дыра: content-addressed единица — job, а не run).
4. **«Rebase/run attempt не переносят чужие доказательства»** — см. таблицу выше.
5. **«Тесты сравнивают consumers на одной матрице fixtures»** — `test/ci-proof.test.mjs`, тест «one state machine gives review, merge and release the same terminal semantics» гоняет один и тот же fixture через `Object.values(CI_PROOF_POLICIES)` (review/merge/release), не только regex по YAML (тот отдельно проверяет только структуру workflow, `test/validate-workflow.test.mjs`).

Отдельно проверил переход документации: `docs/TESTING.md`/`docs/DEVELOPMENT.md` меняют формулировку «prereleases need the fast exact-SHA Validate only» → «every release, including a prerelease, needs the full exact-SHA Validate proof». Это выглядело как расширение объёма гейта на бету, но чтением `scripts/classify-changes.mjs:heavyGatesRequested` подтвердил: коммит с трейлером `Release:` уже до этой задачи (#479) безусловно требовал `heavy=true` — новая формулировка лишь чинит устаревший текст под фактическую автоматизацию и закрывает ровно ту дыру, которую описывает аудит (release-скрипт раньше принимал любой `success`, не разбирая light/full). Прогонов CI это не удорожает.

## Что проверено и корректно

- `buildCiProof`/`evaluateCiProof` — единая точка входа для review/merge/release, консистентна по всем полям (candidate.sha/tree, run.id/attempt/event, requiredChecks/executedChecks/reusedChecks).
- Job-правила (`JOB_RULES`) независимо перепроверяют состав и `conclusion` реальных job (не верят самозаявлению proof), включая фиксированное число мутантных шардов (6) и smoke-шардов (3), совпадающее с `matrix.shard` в workflow.
- `readCiProofArtifact` — самодельный ZIP-ридер, покрыт unit-тестом на сконструированном архиве (store + deflate).
- `parseReuseMarker` — fail closed при отсутствии SHA/run/attempt.
- Workflow YAML валиден, граф `needs` финальной job `proof` совпадает с реальными job id, `if: always()` обеспечивает публикацию доказательства и на красном прогоне.
- Трейлеры коммитов, ветка `issue/541-ci-proof`, отсутствие изменений класса A — соответствуют инфраструктурному треку §1.
- Хендофф-история в issue честно фиксирует найденные и исправленные на живом GitHub Actions дефекты (усечение имени job, YAML flow-mapping с выражением) и результаты трёх реальных прогонов workflow, включая наблюдение `stale` для light/non-full runs.

## Чего не проверял

- Полный `npm run gate:small`/`npm test` не повторял целиком — заявленный зелёный Validate на точном материале (`0fd6977b`) уже покрывает typecheck/test/build по условию ревью; повторно прогнал только новые/изменённые целевые файлы тестов.
- `npm run golden:verify`, `check-docs.mjs`, `model-invariants.mjs`, `pytest tests_backend` — не применимы к диффу (нет `src/**`, геометрии или Python).
- Не воспроизводил реальный workflow_dispatch на GitHub (это уже сделано автором трижды на этой ветке, со ссылками на прогоны в хендоффе); проверил логику и тесты, которые эти прогоны обвязывают.
- Не проверял отдельно `scripts/gate-reuse.mjs`/ключи реюза как таковые (не менялись в этом диффе, кроме одной записи в `check-inputs.mjs`, покрытой `test/check-inputs.test.mjs`).

## Находки

**High: 0. Medium: 0.**

- **Low (не блокирует, оставляю на усмотрение автора/следующей задачи).** `scripts/validate-gate.mjs::provesMutants` и `realOps.jobs` больше не вызываются из продовой логики `validateGate` — решение о доказанности mutant-job теперь принимает `evaluateCiProof`/`JOB_RULES` в `ci-proof.mjs`. Функция и её тесты (`test/validate-gate.test.mjs:66-70`) остаются рабочими и содержательными сами по себе, но как часть решающего пути они мертвы; риск нулевой (защита не ослаблена, просто задвоена), снимаю без цикла — не переписываю продуктовый код сам, вопрос ревьюеру не задаётся, это техническая деталь автора.

## Вердикт

Все AC issue #541 доказаны автотестами, которые я лично прогнал и для критичных защит — лично сломал мутацией и увидел красный. High/Medium находок нет; единственная Low-находка — не более чем указание на будущий cleanup, не блокирует.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/541-ci-proof`, коммит `0fd6977b47d6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1b1886c210926f1aa43a0db47a979c25472384bd`
  ```
  git log --all --format='%H %T' | grep 1b1886c21092
  ```
- Тело issue: `b34ab665a4f9ae621b08dcb3854faec5c4e7fdb1b8e0c3c4e1b5b62ab3eef116`
- Вердикт конвейера: `green` · High 0
