# CODE-REVIEW #555 · заход r1

Материал: `e3bf893e3d76b3276a548ee9182f073c901a12e9` (HEAD, рабочая копия на нём).
Диапазон: `git diff origin/dev...HEAD` (один коммит, `ci: восстанавливать
потерянные запросы ревью (#555)`, `Issue: #555`, `User-Visible: no`).

## Скоуп

Инфраструктурная задача (`infra`, `process`, `tech-debt`, без продуктового S*
на входе — по AGENTS.md это ожидаемо). Из аудита 12.09 (§7.2, остаток I3):
конвейер `process.yml` (#499) убрал нерелевантные label-события, но не
гарантирует, что S4/S7 после `cancelled`/`timed_out`/отказа guard приходят в
понятное конечное состояние. Задача добавляет bounded reconciler — снимок
раз в 30 минут, не polling.

Изменённые файлы: `.github/workflows/process-reconcile.yml` (новый workflow),
`.github/workflows/process.yml` (+1 строка `run-name` — стабильная идентичность
прогона по issue+label), `scripts/process-reconcile.mjs` (новый, 399 строк),
`scripts/mutation-gate.mjs` (+5 мутантов), `test/process-reconcile.test.mjs`
(новый, 8 тестов), `test/review-doc-guard.test.mjs` (+1 тест на согласованность
документации/workflow), `AGENTS.md` + `PROCESS.md` (описание механизма).
`src/**` не тронут — продукт и его контракты не затрагиваются.

Проверка входа (Rule #1 неприменимо буквально — это infra-задача, вход по
AGENTS.md — явное решение владельца применить `S7-code-review`, что и стоит на
issue). Трейлеры корректны: `Issue: #555`, `User-Visible: no` — согласуется с
тем, что changelog не менялся и менять было незачем.

## Как проверялось

- Прочитан `scripts/process-reconcile.mjs` целиком построчно: `parseProcessRun`,
  `latestReviewRequest`, `preparedEvidenceError`, `decideReconciliation`,
  `reconciliationKey`/`markerFor`/`alreadyReported`, и — отдельно, так как это
  единственный слой без юнит-тестов — императивная обвязка `gh()`, `relabel()`,
  `addComment()`, `snapshot()`, `reconcileAll()`.
- Прочитан `.github/workflows/process-reconcile.yml` и изменение `run-name` в
  `process.yml` целиком; сверено, что `RUN_TITLE`-регэксп в скрипте
  соответствует формату `run-name` буквально (issue.number → label.name →
  issue.title через ` · `).
- Прочитаны оба новых теста и добавленный тест в `review-doc-guard.test.mjs`
  построчно, сопоставлены с кодом и текстом документов.
- Прогнан целевой `node --test test/process-reconcile.test.mjs` — 8/8 green
  (см. «Гейты»).
- Сверены все 5 новых `MUTANT_DEFINITIONS` в `scripts/mutation-gate.mjs`:
  каждый `find` дословно встречается ровно один раз в
  `scripts/process-reconcile.mjs`, и для каждого патча прослежено по коду, что
  соответствующий тест в `test/process-reconcile.test.mjs` обязан покраснеть
  (см. разбор по AC ниже) — без пересборки мутационного гейта (дорогой, ночной,
  §513, не гейт code review).
- Прочитаны тело issue #555 и единственный комментарий автора (перечень
  проверок и SHA).

## Находки

### [High] `relabel()` может уронить весь прогон и никогда не эскалировать именно тот случай, ради которого задача заведена

`scripts/process-reconcile.mjs:502-511`:

```js
function relabel(repo, issue, label) {
  gh(['issue', 'edit', String(issue.number), '--repo', repo, '--remove-label', label]);
  const added = gh(['issue', 'edit', String(issue.number), '--repo', repo, '--add-label', label], { allowFailure: true });
  if (added.status !== 0) {
    // Best-effort rollback: leaving an issue without its review state is worse
    // than a loud failed reconciliation.
    gh(['issue', 'edit', String(issue.number), '--repo', repo, '--add-label', label], { allowFailure: true });
    throw new Error(`could not restore ${label}: ${(added.stderr || '').trim()}`);
  }
}
```

Второй вызов `gh(...)` (заявленный «best-effort rollback») результата не
проверяет: `throw` происходит безусловно на основании `added` — результата
ПЕРВОЙ попытки — даже если вторая попытка восстановила метку успешно. Это само
по себе неверно (лишний шум), но хуже цепочка последствий:

- `relabel()` вызывается внутри `reconcileAll()` (`process-reconcile.mjs:354`)
  без единого `try/catch` вокруг записи (проверено: `grep -n "try\|catch"` —
  единственные `try` в файле относятся к `preparedEvidenceError`/
  `hydrateRunEvidence`, не к этому месту).
- Исключение всплывает из `reconcileAll()` в `.then()/.catch()` на
  `process-reconcile.mjs:391-398`: `.then()` (который пишет
  `--output=summary.json`) не выполняется, отрабатывает только `.catch()`,
  `process.exitCode = 2`.
- В workflow `process-reconcile.yml` шаг `upload-artifact` идёт следующим шагом
  без `if: always()` — при ненулевом коде шаг `run:` фейлится, `upload-artifact`
  не выполняется вовсе. Итог прохода: ни machine-readable summary (AC5), ни
  обработки остальных issue в очереди этого тика.
- Критично для AC "намеренно остановленная работа не возобновляется" и общей
  цели issue: `addComment()` (запись дедуплицированного диагностического
  комментария) стоит в коде ПОСЛЕ `relabel()` и в этой ветке не выполняется
  никогда. Значит `alreadyReported()` не увидит маркер, и при следующем тике
  (через 30 минут) `decideReconciliation` примет то же решение `retry` для того
  же события — реконсилер наступит на тот же `relabel()` заново. Если причина
  отказа `--add-label` не самоустранилась (метка удалена, право токена,
  устойчивый rate-limit), это бесконечный цикл: workflow красный каждые 30
  минут, ни одного комментария в issue не появляется.
- Это ровно тот класс отказа, который задача обязана закрыть: «Failure guard,
  … получают один дедуплицированный диагностический комментарий и эскалацию
  человеку» (PROCESS.md, добавлено этим же коммитом) — для отказа самого
  восстановления такой эскалации нет вообще.

Тестами не покрыто: `relabel`, `addComment`, `snapshot`, `reconcileAll` не
экспортированы и не встречаются в `test/process-reconcile.test.mjs` (проверено
`grep -n "export function\|export async function" scripts/process-reconcile.mjs`
против списка импортов теста) — вся императивная запись проверена только
чтением кода, как и требует протокол этого этапа. Ручной прогон автора тоже не
покрывает эту ветку: «read-only CLI на живой очереди — green, records=0,
writes=0» — это прогон с `apply=false` (или без reconciliation-действий),
путь `relabel()` не исполнялся ни разу ни в тесте, ни вручную.

Воспроизведение (по коду, не по запуску): вызвать `relabel(repo, issue, label)`
в ситуации, когда первый `gh issue edit --add-label` вернёт `status !== 0`
(транзиентная ошибка GitHub API/rate limit сразу после `--remove-label`, что в
CI не экзотика) — независимо от исхода второй попытки, функция бросает
исключение и завершает `reconcileAll()` без записи артефакта и без
диагностического комментария.

**Это находка в скоупе задачи**: файл и функция — часть этого же diff, чинится
там же. Из-за High это блокирующий вердикт данного захода.

Минимальное исправление (не мой мандат его вносить, только диагноз): проверять
результат именно повторной попытки, а не переиспользовать `added`; и/или
оборачивать применение решения на уровне `reconcileAll()` в `try/catch` на
issue, чтобы отказ одного issue не ронял снимок остальных и не блокировал запись
`summary.json`.

## Проверено и корректно

- **Матрица решений `decideReconciliation`** (AC1) — для всех перечисленных в
  issue фикстур (cancellation, guard failure/`failure`, timeout,
  `startup_failure`, потерянное событие, уже применённый verdict, ещё идущий
  run) выбирается правильное действие; прочитано построчно и подтверждено
  зелёным целевым прогоном (см. «Гейты»).
- **Дедупликация и запрет повторного расхода цикла** (AC2, частично) — чистая
  часть: `reconciliationKey`/`markerFor`/`alreadyReported`,
  `retryAlreadyIssued` (не более одного авто-relabel на потерянное событие) —
  проверены тестом `#555 repeat reconciliation has a stable dedupe marker` и
  чтением; логика корректна. Применение чужого stage/material отклоняется
  `preparedEvidenceError` (`badIdentity`) — проверено тестом и подтверждено
  соответствующим mutation-witness (`process-reconcile-accepts-foreign-
  prepared-evidence`), прослежено по коду, что мутация переводит исход `retry`
  вместо ожидаемого в тесте `escalate` — тест обязан покраснеть.
- **Гонка между чтением и записью** (AC3, частично) — `reconcileAll` перед
  мутацией перечитывает issue/events/runs (`snapshot(repo, freshRuns,
  first.issue)`) и сверяет `confirmed.action`/`confirmedKey` с исходным
  решением; при расхождении действие не применяется (`record.action = 'noop'`).
  Логика прочитана и корректна как таковая — сама операция записи (см. High)
  ненадёжна, но защита от протухшего решения — да.
- **Здоровый running run не перезапускается** (AC4) — `age <= activeLimitMs` →
  `wait`; подтверждено тестом и mutation-witness
  (`process-reconcile-restarts-healthy-run`: мутация `wait`→`retry` красит тест
  «running waits»).
- **`blocked`/`review-4` сильнее старого события** (AC3/AC4) — проверено тестом
  и mutation-witness (`process-reconcile-ignores-owner-stop`): при `if (false
  && …)` тест `issue(['S7-code-review','blocked'])` перестаёт быть `noop`.
- **Sealed model result не переигрывается** — `run.resultArtifact` →
  `escalate`, тест + witness (`process-reconcile-reruns-sealed-model-result`)
  подтверждают, что без проверки конклюзия ушла бы в `retry`.
- **Один авто-relabel, не бесконечный** — `retryAlreadyIssued` + witness
  (`process-reconcile-retries-lost-event-forever`) подтверждают переход
  `retry`→`escalate` после первого отмеченного повтора — сама детекция
  корректна (описанная в High проблема — это отсутствие записи маркера в одном
  конкретном отказном пути, а не дефект самой проверки).
- **Стабильная идентичность прогона** — `RUN_TITLE`
  (`/^process #(\d+) · (S4-spec-review|S7-code-review)(?: ·|$)/`) сверена
  буквально с новым `run-name` в `process.yml`; `on: issues: types: [labeled]`
  — единственный триггер этого workflow (прочитан файл целиком), значит
  `github.event.label.name` всегда заполнен и regex всегда применим к свежим
  прогонам. Легаси-путь по совпадению `issue.title` (для прогонов до #555)
  безопасно вырождается в `null` при неоднозначности (`matches.length !== 1`).
- **Workflow `process-reconcile.yml`** — `cron: '7,37 * * * *'` (раз в 30 минут,
  не polling одинакового состояния на каждый тик, а один снимок и выход),
  `concurrency: group: process-reconcile, cancel-in-progress: false` не даёt
  двум прогонам работать параллельно, `timeout-minutes: 10` ограничивает
  зависший прогон, `permissions:` минимальны для `GITHUB_TOKEN` (сам скрипт
  везде использует `GH_TOKEN: secrets.HP_PROCESS_TOKEN`, как и остальной
  `process.yml` — сверено по существующему паттерну).
- **Трейлеры и класс изменений** — `Issue: #555`, `User-Visible: no` корректны;
  `src/**` не тронут, changelog не требовался.
- **Тест `test/review-doc-guard.test.mjs` (#555)** — построчно сверен с текущим
  содержимым `PROCESS.md`/`AGENTS.md`/обоих workflow-файлов; все проверяемые
  фрагменты присутствуют дословно.

## Чего не проверял и почему

- **`npx tsc --noEmit`, `npm test` (полностью), `npm run build`+сверка трёх
  копий бандла** — не гонял повторно: Validate на этом же SHA `e3bf893e`
  зелёный (https://github.com/Matysh/houseplan-card/actions/runs/34757318234),
  код с тех пор не менялся (материал ревью = вершина без исполненного
  ребейза). Прогнал только точечно `node --test test/process-reconcile.test.mjs`
  (8/8 green) — дешёвая точечная проверка нового теста, не замена полного
  набора.
- **`node scripts/check-docs.mjs`** — не гонял: диапазон не трогает `src/**`,
  отпечаток скриншотов документации не мог устареть.
- **`npm run invariants -- --config …`** — не гонял: диапазон не трогает
  геометрию, толщину стен, `layout`, `marker.space`, `open_spans` — модель
  вообще не затронута.
- **Браузерные смоки `demo/smoke_*.mjs`, `npm run golden:verify`,
  `python -m pytest tests_backend`, performance-профили** — не гонял и не
  выбирал по `scripts/smoke-select.mjs`: diff не трогает `src/**`, `demo/**`
  (кроме несуществующего — фактически не тронут), `custom_components/**/*.py`
  не менялся, AC задачи ни один из этих гейтов не называет. Это гейты
  визуального/HA-контракта продукта, а изменение — чисто процессный скрипт и
  workflow.
- **Полный ночной `scripts/mutation-gate.mjs` прогон (пересборка бандла на
  каждый мутант)** — не гонял: это дорогой, отдельно расписанный (§513) гейт
  вне цикла ревью. Вместо него по каждому из 5 новых мутантов проверено по
  коду точное совпадение `find`-паттерна и прослежена логика, почему
  соответствующий тест обязан покраснеть — см. «Проверено и корректно».
- **Живой прогон `process-reconcile.mjs --apply=true` на реальной очереди
  issues** — не выполнял (ручного тестирования в этом цикле нет, а
  «доказательство» такого прогона потребовало бы мутировать реальные метки/
  комментарии чужих issue, что вне полномочий ревью). Именно отсутствие любого
  исполнения (тестового или ручного) ветки `relabel()`/`addComment()`/
  `reconcileAll()` — основание High-находки выше.

## Итог

Один High, найден чтением непокрытого тестами кода записи (`relabel()`
безусловно бросает исключение независимо от исхода собственного «best-effort
rollback», что роняет весь прогон реконсилера и — что хуже — пропускает именно
тот единственный диагностический комментарий, который должен предотвратить
бесконечный тихий повтор одного и того же отказа). Находка в скоупе задачи и
не требует отдельного issue — правится в этой же ветке. Остальная (доминирующая
по объёму) логика — чистая функция `decideReconciliation` и её вспомогательные
функции — вычитана, протестирована точечным прогоном и подтверждена всеми
пятью новыми mutation witnesses.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/555-process-reconciler`, коммит `e3bf893e3d76` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9ddf11012bb0a1d9657e3801bb856e32a6cca73f`
  ```
  git log --all --format='%H %T' | grep 9ddf11012bb0
  ```
- Тело issue: `61feb887bc5d5cae5bac106b48e7f07161e697938ac473cc87c5e47a8ca8d4e6`
- Вердикт конвейера: `red` · High 1
