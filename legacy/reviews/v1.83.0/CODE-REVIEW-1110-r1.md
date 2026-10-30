# Код-ревью issue #1110 — заход r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче | — · Документ: docs/reviews/…

Материал: `0c425330342a12920ab21fc6c263f9ee334d094b` (единственный коммит
`0c4253303 fix(ci): drain classification file-list previews`), трек `show`,
маршрут `route: fix`.

## Скоуп

Issue #1110 продолжает #1109: в `classify`-шаге обоих Validate-workflow
(`validate.yml:463`, `validate-product.yml:860`) превью списка изменённых
файлов писалось как `printf '%s\n' "$files" | head -50` под `set -o pipefail`.
При большом диапазоне (сотни-полторы тысяч путей, > ~64 КиБ) `head -50`
закрывает канал раньше, чем `printf` допишет весь вывод, и шаг падает SIGPIPE
(код 141) — ложный отказ классификации, не связанный с корректностью кода
задачи. Классификация решает, какие семейства проверок исполнять для всего
Validate, поэтому ложный отказ блокирует CI произвольной крупной, но
корректной задачи.

Изменённые файлы: `.github/workflows/validate.yml`,
`.github/workflows/validate-product.yml` (генерируется из первого
`scripts/ci-profiles.mjs --write`, #980 — это одна логическая поверхность),
`test/validate-workflow.test.mjs` (новый регрессионный тест),
`docs/release-ledger/v1.82.0/1110.json` (учёт релиза, категория `infra`),
`docs/STATUS.md` и `scripts/ci-registry-inventory.json` (сгенерированная
бухгалтерия). Файлов класса A — ноль, что подтверждает законность
ускоренного инфраструктурного входа без ТЗ (PROCESS.md §11.8, решение
владельца 2026-09-13, issue #562).

## Как проверялось

Независимо прочитан полный diff (`read:diff`), сам код обоих workflow вокруг
изменённых строк, тест-хелперы, исполняющие шаг workflow как реальный
GitHub Actions runner (`test/helpers/workflow-step.mjs`,
`test/helpers/posix-shell.mjs`), и новый тест `test/validate-workflow.test.mjs`
целиком. Затем сопоставлено с хендоффом автора.

Прогнаны адресно (прежние проверки не повторялись без причины):
- `read:diff`, `read:log` — подтверждён точный diff (ровно две строки `head -50`
  → `sed -n '1,50p'` в обоих workflow + бухгалтерия) и единственный коммит
  материала.
- `unit:test/validate-workflow.test.mjs` — **PASS 31/31**, включая новый тест
  `#1110 classify display drains a large real Git list and retains Git failure`
  (ok 31). Это прямое адресное исполнение для обоих ранее недоказанных для
  меня независимо утверждений автора (AC1/AC2) — тест гоняет настоящий Bash
  на настоящем Git-репозитории с 1600 длинными путями (>200 КБ, подтверждено
  `assert.ok(Buffer.byteLength(expected) > 200_000)`), исполняет реальный
  `classify`-шаг обоих файлов без подмены воркфлоу/Git/shell.
- `static:ci-registry-inventory` — **PASS**, сгенерированная бухгалтерия
  (ссылки на новый `docs/release-ledger/v1.82.0/1110.json`) согласована.
- `static:status-snapshot` — **PASS**, изменённая строка `Tests` в
  `docs/STATUS.md` (5766 → 5767) соответствует фактическому числу узлов
  (ровно один новый `test(...)` добавлен в существующий файл).

Переиспользовано без повторного прогона (материал/входы/окружение не
менялись после зелёного `validate-gate`, https://github.com/Matysh/houseplan-card/actions/runs/40640127541):
build/typecheck, продуктовые unit, bundle policy/budget, unused/monolith,
range guards, `ci-profiles.mjs --check`, `process-gate.mjs --range
origin/dev..HEAD --issues --report` (проверяет трейлеры `Issue:`/
`User-Visible:` и S-метки для всего диапазона). Эти прогоны не зависят от
кода, который я проверяю отдельно исполнением теста #1110 — дублировать
`gate:small`/`npm test` целиком не требовалось.

Не прогонялись: browser-smoke, golden, performance, backend pytest — тело
issue не называет смок, диапазон не затрагивает продуктовый код/UI, и
изменение не способно повлиять на эти семейства (PROCESS.md §8, «объём
гейтов соразмерен задаче»).

## Независимый разбор

- Фикс симметричен для обоих файлов и буквально совпадает с рекомендацией
  issue и прецедентом #1109: `sed -n '1,50p'` не завершает работу после
  печати диапазона (в отличие от `head`), поэтому не закрывает конец канала
  раньше `printf` — SIGPIPE воспроизвести нельзя по построению команды.
  Поведение на пустом диапазоне не меняется (пустая строка печатается и
  там, и там) — подтверждено исполнением (`empty.classified === '\n'`,
  `empty.status === 0`).
- Полный список `$files`, который видит сам классификатор
  (`printf '%s\n' "$files" | node scripts/classify-changes.mjs`), не тронут:
  это отдельный, непострадавший канал. Тест подтверждает это отдельно от
  усечённого человекочитаемого превью (`large.classified === expected`,
  где `expected` — все 1600 путей).
- Отказ Git (`git diff --name-only` не может прочитать дерево) по-прежнему
  останавливает шаг раньше классификатора и печатает
  `Cannot read the complete task range` — `pipefail` и явная проверка кода
  возврата `git diff` (`|| { ...; exit 1; }`) не задеты правкой. Подтверждено
  негативным сценарием теста: удалённый объект дерева во временном
  Git-репозитории → `missing.status !== 0`, `missing.classified === null`.
- Других мест, где `head` читает именно из пайпа под `pipefail` (а не из
  файла), в обоих workflow не найдено: `head -1
  scripts/backend-coverage-baseline.txt` (validate.yml:1369/1736) — чтение
  обычного файла через подстановку команды, SIGPIPE там не возникает,
  вне скоупа issue и корректно не тронуто.
- `docs/release-ledger/v1.82.0/1110.json`: категория `infra` обоснована
  правильно (PROCESS.md §8, таблица категорий) — поведение продукта не
  меняется, `introducedBy` не требуется (это не правка бета-функции).
  `docs/STATUS.md`/`ci-registry-inventory.json` — сгенерированная
  бухгалтерия, согласованность подтверждена статическими проверками выше.
- Трейлеры `Issue: #1110`/`User-Visible: no` — отдельно текст коммита не
  читался (нет адресного check для вывода полного тела коммита), но
  `process-gate.mjs --range origin/dev..HEAD --issues --report` в хендоффе
  уже прогнан на этом самом материале и проверяет именно это; материал не
  менялся после прогона — переиспользовано.

### AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (защитный): крупный настоящий diff не прерывает классификацию SIGPIPE, классификатор получает полный список, превью — ровно первые 50 путей | `unit:test/validate-workflow.test.mjs`, тест `#1110 classify display drains a large real Git list and retains Git failure`, исполнен повторно в этом ревью: PASS (ok 31/31) | Тот же тест на исходном `head -50` (до правки, по заявлению автора): реальный Bash завершает `classify` кодом 141 на 1600 путях >200 КБ — обычный негативный вход на непатченной реализации, не мутант |
| AC2 (защитный): пустой диапазон остаётся корректным; недоступный объект дерева Git даёт отказ до вызова классификатора, ошибки не подавляются | Тот же тест, те же два под-сценария (`empty`, `missing`) в одном прогоне: PASS | Негативный вход — удалённый объект дерева во временном Git-репозитории; без исправления поведение то же (путь кода не менялся) — `missing.status !== 0`, классификатор не вызван |
| AC3: выбор семейств проверок и прочие pipeline-пути не меняются | Разбор diff (`read:diff`) — изменены буквально две строки отображения; классификатор получает тот же вход, что и раньше | Проверено чтением, не исполнением: любое изменение входа классификатора дало бы расхождение `large.classified` в тесте AC1, которого нет |

## Что проверено и корректно

- Сама правка минимальна, симметрична для обоих workflow, устраняет ровно
  описанный в issue класс дефекта тем же приёмом, что и принятый прецедент
  #1109.
- Полнота входа классификатора и сохранение отказа Git при недоступном
  дереве подтверждены исполнением реального Bash/Git, а не статикой.
- Бухгалтерия (release ledger, STATUS.md, ci-registry-inventory.json)
  сгенерирована и согласована корректно, категория `infra` обоснована.
- Классификация изменения (трек `show`, ускоренный инфраструктурный вход
  без ТЗ, файлов класса A — ноль) соответствует PROCESS.md §11.8.

## Чего не проверял

- Полный текст коммита (трейлеры `Issue:`/`User-Visible:`) отдельно не
  читал — нет адресного check для вывода тела коммита; положился на уже
  выполненный на этом материале `process-gate.mjs --issues --report` (PASS)
  из хендоффа, материал с тех пор не менялся.
- Browser-smoke/golden/performance/pytest не прогонял — не затронуты диффом
  и не названы в теле issue.

## Маршрут

`route: fix` — задача проходит все критерии §5 (сложность и риск низкие,
одна логическая поверхность — classify-шаг обоих зеркальных workflow,
нет миграции/нового UX-контракта/влияния на производительность или touch,
ожидаемое поведение — отсутствие ложного SIGPIPE — зафиксировано самим
issue и прецедентом #1109).

Побочных находок вне скоупа нет (`outside_findings` пуст, политика
`mode=issues`).

Гейты: прогнаны адресно `unit:test/validate-workflow.test.mjs`,
`static:ci-registry-inventory`, `static:status-snapshot`, `read:diff`,
`read:log` (все PASS, см. «Как проверялось»). Переиспользован зелёный
`validate-gate` (https://github.com/Matysh/houseplan-card/actions/runs/40640127541)
для build/typecheck/bundle/range-guards/process-gate/ci-profiles --check.
Browser-smoke/golden/performance/backend не прогонялись — не требуются по
диффу и телу issue.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImY0MGJiYzM0Y2M1OTBhODA4ZTliZDA2NmFlMTIyNTI0ZjFjZTQ4ZmE3MzNmYWMwMjg3ZGQ2MzAyMjg0ZDAzOTkiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwY2IxMzMxZDE2MjQ5N2NjM2RmN2QwMWUyZjMxMDA2NGI5OWM5MzFiZDFiMDFhOTAwMjNhMjBlZTU4ZDk2OWUyIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTEwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwYzQyNTMzMDM0MmExMjkyMGFiMjFmYzZjMjYzZjllZTMzNGQwOTRiIiwidHJlZSI6IjE1YzM0YWUyYzQ4ZTU0MjY2NWM2NzFjNDMxNzZjNmQ3ZTcwODk5MjgiLCJib2R5RGlnZXN0IjoiMWJjMGJiMTBkZTQ5YWI3MDNjNzdmYWI4OWRiOWE1NjhiZjY5ZDkyZWZkMmNkZWI2NDExNGFjNzNmODI4ODY3OSIsInByb2R1Y2VyUnVuIjoiNDA2NDA4NTQ1MDAiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijg4MWYzYzJjOTAwYWRlYzBmNmE0YzcwMjI3NGI3MGYzNWQ5NDFkZGRiODY4YzM4MWVmNjBjNzUxZDg2NzQ1MWIiLCJ2ZXJkaWN0RGlnZXN0IjoiOGY5YjY1YWRhZjhmNTJjM2M1YmMzOWM4MjA5NzUzN2UzOWZkMmFjY2M3MzQzMWQ1NzAzYmMxNTE4OGJlMjkyYiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiZmQ3ZmU3MTMzMTdjMjc3M2ZhN2IwZjYwMDM1ZDk4MGVjYzViOWVlNmM5M2M2Nzc0ODBjY2Y1NGNmNGFhN2Q5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDYxOTc1OTA3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTEwI2lzc3VlY29tbWVudC02NDYxOTc1OTA3IiwiYm9keURpZ2VzdCI6ImVhNzg5MmY1MTUzN2YxMDJlMzk3ZDEyNTEwMmFjMzY2YjQwNWFiZDQzYTk0ODUxYjMwNWI2ZmJlMTI4NDU0N2IifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1110-validate-display`, коммит `0c425330342a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `15c34ae2c48e542665c671c43176c6d7e7089928`
  ```
  git log --all --format='%H %T' | grep 15c34ae2c48e
  ```
- Тело issue: `1bc0bb10de49ab703c77fab89db9a568bf69d92efd2cdeb64114ac73f8288679`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40640854500,"run_attempt":1,"digest":"d9fd5bda46b44215c3ac260217de634f604f638dc31b09360331940909d13fc4"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzIsIm91dHB1dF90b2tlbnMiOjE5MDM0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExODk2MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMyODIyNTcsImNvc3RVc2RFc3RpbWF0ZSI6MS4zMjI3ODc0fV0sInR1cm5zIjo0NSwiZHVyYXRpb25NcyI6MjU0MTA4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zMjI3ODc0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=72 output_tokens=19034 cache_creation_input_tokens=118963 cache_read_input_tokens=3282257 num_turns=45 -->
