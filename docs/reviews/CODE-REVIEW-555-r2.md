# CODE-REVIEW #555 · r2

Материал: `d0ecd5383155bfa39c84d66961f89c8f829db279` (рабочая копия — HEAD detached на этом SHA).
Предыдущий раунд: r1, вердикт красный, документ на `e3bf893e3d76b3276a548ee9182f073c901a12e9`
(см. комментарий issue от 2026-09-13T12:43:17Z).

## Скоуп раунда

r1 нашёл один High: в `relabel()` вторая («rollback») попытка `--add-label` не проверялась,
а `addComment()` стоял в коде после `relabel()` — при отказе восстановления диагностика не
публиковалась и терялась запись в `summary.json`, создавая риск бесконечного молчаливого
цикла retry без единой эскалации. Остальная матрица `decideReconciliation` и race-guard
«перечитать перед записью» были приняты r1 без замечаний.

Дельта r1→r2 (`git diff e3bf893e..d0ecd538 --stat`):

```
.github/workflows/process-reconcile.yml |   1 +
docs/reviews/CODE-REVIEW-555-r1.md      | 242 ++++++++++++++++++++++
scripts/mutation-gate.mjs               |  35 +++++
scripts/process-reconcile.mjs           |  76 +++++++---
test/process-reconcile.test.mjs         |  64 ++++++++-
test/review-doc-guard.test.mjs          |   2 +
```

Дельта локальна: правка одной функции записи (`relabel`), выделение write-path в
`applyReconciliationDecision`, обработка ошибки в `reconcileAll` и один `if: always()`
в workflow. Логика `decideReconciliation` (матрица фикстур) не тронута — полный разбор
не требуется, разбираю дельту и то, до чего она дотягивается (сам write-path и его тесты).

## Закрытие раунда r1

| находка r1 | чем закрыта | где видно |
|---|---|---|
| Вторая попытка `--add-label` не проверялась, ошибка первой маскировала реальный результат | `relabel()` теперь использует результат второй попытки как авторитетный: `if (restore.status !== 0) throw ...` | `scripts/process-reconcile.mjs:296-305` (было: безусловный throw с данными первой попытки) |
| `addComment()` шёл после `relabel()` → при отказе восстановления диагностика не публиковалась | Write-path вынесен в `applyReconciliationDecision`: сначала `ops.comment(...)`, затем (только для `retry`) `ops.relabel(...)` | `scripts/process-reconcile.mjs:314-320` |
| Исключение из `relabel`/`addComment` не перехватывалось в `reconcileAll`, весь снимок тика терялся | Вызов обёрнут в `try/catch`; ошибка кладётся в `record.error`, инкрементирует `failures`, цикл `for` продолжается | `scripts/process-reconcile.mjs:375-383` |
| `--output=summary.json` не писался при исключении → `upload-artifact` без `if: always()` терял снимок | CLI пишет `summary.json` до установки `process.exitCode`; `exitCode=1` выставляется только после записи файла, если `summary.failures` | `scripts/process-reconcile.mjs:415-423` |
| `upload-artifact` не имел `if: always()` | Добавлен `if: always()` к шагу «Опубликовать компактный machine-readable итог» | `.github/workflows/process-reconcile.yml:52` |

Находка была в скоупе задачи и правится в этой же ветке — отдельный issue не заводился (соответствует правилу для High без выхода за скоуп).

## Как проверялось

Прочитан полный diff `git diff e3bf893e..d0ecd538` (все 6 файлов). Прогнано точечно (Validate
на этом SHA уже green — см. ниже, полный набор не перегонял):

- `node --test test/process-reconcile.test.mjs` — 11/11 green, включая 3 новых теста на
  write-path (порядок comment→relabel при отказе комментария, авторитетность второй попытки
  `--add-label`, сохранение ошибки в summary без обрыва снимка).
- `node --test --test-name-pattern="#555" test/review-doc-guard.test.mjs` — 1/1 green,
  включая новую проверку `if: always()` в workflow-файле; эта проверка умеет падать —
  строки `if: always()` не было в файле на SHA r1 (видно из diff).
- Три новых mutation witness прогнаны точечно через `node scripts/mutation-gate.mjs --id=<id>`
  для каждого из `process-reconcile-relabels-before-durable-marker`,
  `process-reconcile-ignores-failed-label-restore`, `process-reconcile-write-error-aborts-summary` —
  все 1/1 «поймано», подтверждает заявление автора «3/3».
- Прочитан весь итоговый `reconcileAll`/`relabel`/`applyReconciliationDecision` построчно —
  подтверждено, что `record.applied` по умолчанию `false`, ошибка одной задачи не растёт в
  `mutations`, `failures` не сбрасывается между итерациями цикла, `alreadyReported` защищает
  от повторной публикации комментария на следующем тике (комментарий уже сохранён к моменту
  отказа relabel — проверено чтением, не исполнением, т.к. это требует реального GitHub API).
- Проверено `git diff --stat -- src/` — пусто, docs-гейт (`check-docs.mjs`) не требуется.
  Геометрия/`layout`/`marker.space`/толщины не задеты — инварианты модели не требуются.
  Diff не касается рендера — golden не требуется. `custom_components/**/*.py` не тронут —
  pytest не требуется. Смоки не применимы (не браузерный код).

## Чего не проверял

- Полный `npm run typecheck` / `npm test` / `npm run build` не перегонял — Validate на
  `d0ecd538` подтверждён зелёным (https://github.com/Matysh/houseplan-card/actions/runs/34758274801),
  код с тех пор не менялся.
- Полный ночной mutation-gate (все ~200+ мутантов) не гонял — вместо этого точечно проверил
  3 новых мутанта, относящихся к делте; остальные не касаются изменённого кода.
- Реальный прогон workflow `process-reconcile.yml` на живой очереди GitHub Actions (нет
  доступа/не требуется по PROCESS.md — ручное тестирование в цикле не предусмотрено).
- Расхождение SHA в ссылках на Validate (автор в комментарии r2 привёл
  `.../actions/runs/34758118947`, а этому раунду дан `.../actions/runs/34758274801`) не
  расследовал отдельно: обе ссылки относятся к одному SHA `d0ecd538`, а прогон, названный
  ревьюеру как подтверждённый для этого материала, зелёный — этого достаточно для решения
  не перегонять дорогие гейты.

## Унаследовано из r1

Без повторной проверки приняты (документ r1: комментарий issue от 2026-09-13T12:43:17Z,
на SHA `e3bf893e3d76b3276a548ee9182f073c901a12e9`; эта часть кода не в дельте r2):

- Матрица `decideReconciliation` по всем фикстурам AC (cancellation/timeout/guard
  failure/потерянное событие/applied verdict/running) — 8/8 green на r1, код функции не
  изменился в дельте r2.
- Race-guard «перечитать перед записью» (сам факт двойного чтения `snapshot`/`processRuns`
  перед мутацией) — логика не менялась, изменилось только то, что происходит после неё
  (сама операция записи), что и было предметом High-находки.
- Идентичность прогона по `run-name`, трейлеры и класс изменений — не затронуты дельтой.

## Вердикт

High из r1 закрыт: показано построчно (таблица выше), тесты и mutation witnesses
подтверждают, что фикс действительно закрывает сценарий (комментарий персистентен до
фолбл relabel, вторая попытка restore авторитетна, ошибка записи не топит весь снимок
тика). Новых находок в дельте не обнаружено. Трейлеры (`Issue: #555`, `User-Visible: no`)
корректны, changelog не требуется — изменение не видно пользователю продукта.

**Зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/555-process-reconciler`, коммит `d0ecd5383155` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8133acd9b590c43a9bc938d35fef2a570f2c9c84`
  ```
  git log --all --format='%H %T' | grep 8133acd9b590
  ```
- Тело issue: `61feb887bc5d5cae5bac106b48e7f07161e697938ac473cc87c5e47a8ca8d4e6`
- Вердикт конвейера: `green` · High 0
