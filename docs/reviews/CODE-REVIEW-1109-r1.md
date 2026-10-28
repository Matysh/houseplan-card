# CODE-REVIEW — issue #1109, заход r1

**Материал:** `0a95daeb64860aad023095aff6550007b5b815e5` (рабочая копия на этом SHA).
**Диапазон:** `git log --oneline origin/dev..HEAD` → один коммит:
`0a95daeb6 fix: drain beta-derived commit diagnostics before push`.
**Трек:** show. **Класс:** B (инфраструктура — `.github/workflows/**`, `test/**`, `scripts/**`-метаданные) — по AGENTS.md
входит прямо в `S7-code-review`, без анализа/ТЗ.

## Скоуп

Один диагностический шаг workflow `_beta-derived.yml` (job `accept`, шаг
«Коммит в dev») обрывал публикацию производных артефактов (скриншоты/golden)
кодом 141 (SIGPIPE), когда `git show --stat --format='%H %s' HEAD | head -40`
закрывал канал раньше, чем `git show` дописывал большой вывод, — под
действующим `set -euo pipefail`. Задача узкая, класса B: читать диагностику
полностью, сохранив ровно 40 выводимых строк, `pipefail`, приёмку артефактов,
контроль происхождения и штатный push без изменений. Продукт, UI, touch,
перф, миграции, i18n — неприменимо; `User-Visible: no` соответствует факту:
изменения ограничены `.github/workflows/_beta-derived.yml`, тестом,
release-ledger и авто-метаданными (`docs/STATUS.md`, `scripts/ci-registry-inventory.json`).

Изменённые файлы (5, все входят в `fullHunkReads`):
`.github/workflows/_beta-derived.yml`, `docs/STATUS.md`,
`docs/release-ledger/v1.82.0/1109.json`, `scripts/ci-registry-inventory.json`,
`test/workflow-step.test.mjs`.

## Как проверялось

1. Прочитан canon в порядке PROCESS: `docs/SCOPE.md`/`AGENTS.md` (классификация
   B/infra, трек show, прямой вход в S7 — подтверждено, расхождений с
   `docs/release-ledger/v1.82.0/1109.json` нет), тело issue #1109 (AC1/AC2 и
   «Проверка результата»), хендофф автора.
2. Независимо прочитан полный `read:diff` (единственный реальный хаб изменения —
   строка `head -40` → `sed -n '1,40p'`; остальное — тест, ledger и
   авто-сгенерированные счётчики) и `read:log` (один коммит, совпадает с
   материалом).
3. Прослежен вызывающий путь: `beta-derived.yml` (тонкий, не в диффе) зовёт тело
   `_beta-derived.yml@dev` через `workflow_call`; шаг «Коммит в dev» не задаёт
   `shell:`, ни job, ни workflow не задают `defaults.run.shell` → раннер
   исполняет тело как `bash -e {0}` (без pipefail от shell), но тело само
   начинается с `set -euo pipefail` — это сохранено диффом без изменений.
4. Проверено рассуждение о `sed -n '1,40p'`: без `q`/`Q` GNU sed не завершает
   чтение по достижении верхней границы диапазона — он продолжает читать stdin
   до EOF (в отличие от `head`, который закрывает канал раньше). Это и есть
   устранение гонки SIGPIPE: пишущий (`git show`) теперь всегда дочитывается до
   конца, а напечатанными остаются первые 40 строк — поведение, описанное в
   AC1, достигается структурно, а не только по утверждению автора.
5. Прочитан `test/helpers/workflow-step.mjs` (не в диффе, инфраструктура из
   #766/#960) — это не фикстура, а реальный парсер YAML + исполнитель тела шага
   через настоящий раннер-shell (`bash -e {0}` для этого шага, без добавленного
   тестом pipefail): подмены реализации нет, `set -euo pipefail` в проверяемый
   прогон берётся из исходной строки шага (`lines[0]`), не от обвязки.
6. Выполнен через `mcp__houseplan_review__run_check`:
   - `unit:test/workflow-step.test.mjs` → **passed, exitCode 0** (свежий прогон
     на материале, не переиспользование: это единственный защитный тест для
     AC1/AC2, добавленный этим же диффом, и натурный риск SIGPIPE — реальный
     ОС-канал, а не симуляция — заслуживает собственного прогона, а не только
     ссылки на зелёный validate-gate).
   - `read:diff`, `read:log` — для независимой сверки границ материала.
7. Переиспользовано (не повторялось): validate-gate на этом SHA —
   https://github.com/Matysh/houseplan-card/actions/runs/40636954842 (зелёный,
   `review-light proof is complete`) — покрывает build/typecheck/bundle и общий
   `npm test`/`gate:small` по заявлению хендоффа (293 c, 0 падений).

## AC и защитные проверки

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 — большой диагностический stat дочитывается полностью, следующая команда достигается без SIGPIPE | Реальный Git-репозиторий с коммитом >64 KiB вывода `git show --stat`, тело шага исполнено настоящим раннер-shell (`unit:test/workflow-step.test.mjs`, тест `#1109`) — `status===0`, `stdout` = первые 40 строк + маркер границы | Исходная реализация (`head -40` вместо `sed -n '1,40p'`) под тем же `pipefail` даёт код 141 и не доходит до маркера границы — зафиксировано как структурный разбор (п. 4 выше) и авторским локальным логом `/home/matysh/hp-1109-old-red.log` (не воспроизводимый мной на этом материале, т.к. правка уже снята — это не мутант, а исторический прогон до фикса); сам актуальный тест при обратной замене строки на `head -40` исполнил бы ровно тот же путь и получил бы код 141 — проверено чтением теста и его утверждений, не исполнением мутанта (#905) |
| AC2 — настоящая ошибка `git show` остаётся ненулевым завершением, следующая команда не исполняется | Тот же тест, подслучай `missingHead`: пустой репозиторий без HEAD, реальный `git show` отказывает, `status!==0`, `stdout` не содержит маркер границы, `stderr` содержит `HEAD` | Обычный негативный вход (git-репозиторий без коммитов) — настоящий отказ `git show`, не маскируется ни `head`, ни `sed` веткой; этот путь не менялся диффом и не стал бы отличаться на старой реализации — приведён как подтверждение отсутствия регрессии, а не как различающий старое/новое свидетель |

Вторая строка таблицы — не дефектная находка: третий столбец заполнен,
обычный тест есть, это выполнение требования §2.7/#435, а не пробел.

## Находки

**High/Medium в скоупе задачи: нет.** Правка — ровно однострочная замена
`head -40` → `sed -n '1,40p'` в предсказанном месте, с одним новым тестом,
который реально исполняет изменённую строку через настоящий shell на
настоящем большом Git-дереве и проверяет оба направления (полный дренаж и
немаскируемую ошибку). Сопутствующие файлы (`docs/STATUS.md`,
`scripts/ci-registry-inventory.json`, `docs/release-ledger/v1.82.0/1109.json`)
— мех анические/учётные правки, согласованные с диффом (счётчик тестов +1,
новый ledger-файл с корректной `category: infra` и `rationale`, inventory
подхватывает новый ledger-файл в обоих местах списка).

**Побочная находка вне скоупа (передана ниже как outside finding, mode=issues):**
тот же класс дефекта (SIGPIPE при `| head -N` под активным `set -o pipefail`)
остаётся непочиненным в `.github/workflows/validate.yml:463` и
`.github/workflows/validate-product.yml:860` — идентичная пара
`printf '%s\n' "$files" | head -50` внутри шага `classify`, который
выполняется под `set -o pipefail` (строки 418/429 и 826 соответственно) и
определяет судимый диапазон файлов для всего гейта классификации. `$files` —
список путей всего диапазона задачи; при достаточно большом рефакторе (по
порядку величины — сотни-полторы тысяч путей, как в фикстуре этого же теста)
это тот же самый риск ложного падения шага классификации. Диапазон #1109 эти
файлы не трогает — находка не блокирует данный раунд.

## Проверено и корректно

- Единственная содержательная строка диффа (`_beta-derived.yml`, диагностика
  коммита) соответствует описанной проблеме и устраняет её структурно (sed
  дочитывает stdin до EOF без `q`), не затрагивая `pipefail`, приёмку
  артефактов (`docs-accept.mjs`/`golden-accept.mjs`), происхождение golden
  (`productWorkflow`-проверку) и штатный push с `merge-candidate.mjs`.
- Новый тест — не фиктивный прогон: разбирает актуальный YAML (`findStep`),
  извлекает ровно одну строку `git show --stat...` и исполняет её настоящим
  раннер-shell с реальным Git-деревом >64 KiB вывода и с пустым репозиторием
  для негативного случая; выполнен сейчас и зелёный (`unit:test/workflow-step.test.mjs`
  → passed).
- Route §5: `complexity` ≤3 (однострочная правка + тест), `surfaces` — один
  шаг одного workflow, `migration` — нет, `ux-contract` — нет (не
  пользовательское поведение), `perf-touch` — не затронуты, `undocumented` —
  ожидаемое поведение зафиксировано дословно в самом issue («Проверка
  результата» п.1–2) и теперь в `docs/STATUS.md`/ledger. Все критерии §5
  пройдены → `route: fix`.
- `docs/release-ledger/v1.82.0/1109.json`: `category: infra`, обоснование
  соответствует факту (B/C-only, без влияния на продукт/пользователя
  относительно v1.82.0) — корректно, не вводит задачу в пользовательский
  milestone.
- `docs/STATUS.md`: добавленный абзац точно описывает эффект фикса; счётчик
  `Node unit` увеличен на 1 (5765→5766), что соответствует ровно одному новому
  `test(...)` в диффе — никакого расхождения «число показано дважды с разными
  источниками» (§8) нет, второе место со счётчиком в файле не тронуто и не
  должно было.
- Trailer `User-Visible: no` ожидаем и не противоречит факту: ни один
  changelog не тронут, продуктовый код не тронут.

## Чего не проверял и почему

- `build:build`/`build:typecheck`/`build:bundle:sync` — не прогонял заново:
  диапазон не трогает `src/**`, `rollup.config.mjs` или bundle-манифест;
  зелёный validate-gate на этом же SHA уже покрывает их, а задача не меняет их
  входы.
- Смоки (`demo/smoke_*.mjs`) и golden — не применимы: диапазон не трогает UI,
  рендер или golden-эталоны; задача явно это исключает («Продукт, артефакты,
  эталоны... не меняются»).
- Полный `npm run gate:small` — не повторял: хендофф приводит его зелёный
  прогон (293 c, 0 падений) на этом материале, а единственный риск-ориентированный
  тест для этой задачи (`test/workflow-step.test.mjs`) я перепрогнал адресно
  через `run_check` и получил тот же зелёный результат независимо.
- Исполнение мутанта (временная замена `sed` обратно на `head -40` в реальном
  workflow-файле) не проводилось — запрещено общей политикой вне ночного
  workflow (#905); «чем краснеет» для AC1 закрыт структурным разбором поведения
  `sed` без `q` плюс код самого теста, который детерминированно упал бы на
  старой строке (разбор, не исполнение мутанта).

## Маршрут и вердикт

`route: fix` — задача проходит все критерии §5 (infra, класс B, один шаг,
без миграций/UX/перф/touch, поведение зафиксировано в issue и в документах).
Находок High/Medium в скоупе нет → **вердикт: green**.

Побочная находка (SIGPIPE-риск в `validate.yml`/`validate-product.yml`)
передаётся как Medium outside finding, не влияет на вердикт этого раунда.

## Гейты: что прогнано и что нет

Прогнано в этом раунде (через `mcp__houseplan_review__run_check`):
- `unit:test/workflow-step.test.mjs` — **passed** (единственный защитный тест
  задачи; адресный прогон, т.к. это новый тест этого диффа и натурный
  SIGPIPE-риск).
- `read:diff`, `read:log` — для подтверждения границ материала.

Переиспользовано без повторного прогона (зелёный validate-gate на этом SHA,
https://github.com/Matysh/houseplan-card/actions/runs/40636954842):
build/typecheck/bundle-sync, общий `npm test`/`gate:small` (293 c, 0
падений — из хендоффа, согласуется со scope и диффом).

Не прогонялись и не требовались: смоки, golden-раннер, pytest/HA-harness —
диапазон их не затрагивает (CI-only diagnostic fix).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjVjNzZkOWM5MDVjNjg5Njc2YTZiMGViZjRmMGQyZTQ3M2ZjZTI0M2JmMGU3NDhjYmExY2I4M2JmNjgzNDU4ZGIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJhNWY4MmU1MWE2ZGQ2MGRkNDExMjQ5ODMzNDdkYWI4M2Y4MThlYWUyNDY2NGQzYzIyMzM3MzBhMjBkMDY1YmE3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTA5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwYTk1ZGFlYjY0ODYwYWFkMDIzMDk1YWZmNjU1MDAwN2I1YjgxNWU1IiwidHJlZSI6IjNiOTkyOWYwYTYwNjRhNjg4NGFmNDViZGU4ZjY0NDIyMzM0ODFiNWMiLCJib2R5RGlnZXN0IjoiMjJkNTQxM2RhMjA3YjYyZDI0NWRkMzgwMDI0OTE0OTk3N2EyMzJkYzNjMjlmM2E4ODc1ZGQ3MzgyM2FlNWZmYSIsInByb2R1Y2VyUnVuIjoiNDA2Mzc1MTYzMDEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjhlMmI1YTQyYTBjMjg3Y2NiMWE4M2U1NTJiYTlmNTk5NDVkNDgzNGM2ZDRkYTdjY2VjNzI5YzRiZTIzYThiZTUiLCJ2ZXJkaWN0RGlnZXN0IjoiYmFjM2NiYjljZTc4MGM5ZTdlYzE5NjYzY2M5ZjcyZTU0MDRiNzdjY2Q0NzE4MjgwZTExYjQwMTI5NzhhMjc1NSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI5ZjZlNzUyMjdiNmI3ZTA3ZGI3Zjg2NWI3ZDhiM2M1ZjU5NGQ3YjUxZGRmOTJlZTFhODE5ZTc3NDRlNTQ0ZmEyIiwiZmluZGluZ3MiOlt7ImlkIjoiRjEiLCJpc3N1ZSI6MTExMCwidXJsIjoiaHR0cHM6Ly9naXRodWIuY29tL01hdHlzaC9ob3VzZXBsYW4tY2FyZC9pc3N1ZXMvMTExMCIsInBheWxvYWREaWdlc3QiOiI3ZGE2ZTM4OWQ2NmZkNTliNGFkZjQ1MGNmMDI4YTZlNmU0NDcwNmZhNjg5NzM1MzU2Yzk4OGJkYzM3OWMyNzk4IiwiYm9keURpZ2VzdCI6IjFiYzBiYjEwZGU0OWFiNzAzYzc3ZmFiODlkYjlhNTY4YmY2OWQ5MmVmZDJjZGViNjQxMTRhYzczZjgyODg2NzkiLCJ0aXRsZURpZ2VzdCI6ImU3MDY2N2M4OTVkMjU3YWRiZTBkMDE5NDdlNzQ4YjEwNTYzZWZlNzdmOTVmMmQwY2JlNGQwZjJjOTRkZTE4ZDEifV0sImNvbW1lbnQiOnsiaWQiOjY0NjE0NjMyMTcsInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzExMDkjaXNzdWVjb21tZW50LTY0NjE0NjMyMTciLCJib2R5RGlnZXN0IjoiOGRkN2UyZmViZmY2ODAwMmE4MjM2NjE1ZWRhYzFlMDRmOWExMjkwYjhiMGViNjg1ZjU1ZTZlYWNkZDJiNTdkNyJ9fX0 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1109-beta-derived-sigpipe`, коммит `0a95daeb6486` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3b9929f0a6064a6884af45bde8f6442233481b5c`
  ```
  git log --all --format='%H %T' | grep 3b9929f0a606
  ```
- Тело issue: `22d5413da207b62d245dd3800249149977a232dc3c29f3a8875dd73823ae5ffa`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40637516301,"run_attempt":2,"digest":"31207a74c14c2884c6a09bbb223e4d0fb54658b73b414a769b2dd5346e29b4d3"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDIsIm91dHB1dF90b2tlbnMiOjI1MjExLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyODk2MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE4NjUxNjIsImNvc3RVc2RFc3RpbWF0ZSI6MS4xNDEwNzg0fV0sInR1cm5zIjozMiwiZHVyYXRpb25NcyI6MzIzMzUwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4xNDEwNzg0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=42 output_tokens=25211 cache_creation_input_tokens=128963 cache_read_input_tokens=1865162 num_turns=32 -->
