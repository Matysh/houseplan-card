# CODE-REVIEW — issue #1116, заход r2

Вердикт: зелёный · заход r2 · блокирующих циклов 1/2 · High: 0 · Medium: 0

Материал: `4e6eae15b7d515531d0561226a8af6b5e32c28dd` (пять коммитов диапазона
`read:log`: `5441944a4` «fix: bound continuation discovery and retain terminal
read diagnostics», `75a1a2eaf` «test: bind the complete safe discovery
diagnostic in CLI evidence», `c7e30647a` «docs: review document for #1116»,
`a4f829c19` + `4e6eae15b` — два коммита «docs(reviews): индекс после сдвига
каталога (#1116)», ветка `issue/1116-continuation-read`). Трек: `show`. Этап:
`code`. Маршрут вердикта: `route: fix` — задача по-прежнему проходит все
критерии §5 (сложность/риск низкие, одна поверхность — два bodyless GET
внутри `workflow-continuation.mjs`, без миграции конфига, без нового
UX-контракта, без влияния на производительность/touch, ожидаемое поведение
зафиксировано в `docs/DEVELOPMENT.md`/`docs/analysis/1116-continuation-discovery.md`).

## Скоуп раунда

r2 закрывает единственную находку r1 (M1, Medium в скоупе): диф задачи ранее
удалял чужой принятый `docs/reviews/SPEC-REVIEW-1120-r1.md` и занижал счётчики
`docs/reviews/INDEX.md`. Код `continuation-discovery.mjs`/`workflow-continuation.mjs`
и тесты `test/continuation-discovery.test.mjs`/`test/proof-loop-856.test.mjs`
не менялись по содержанию относительно r1 — переданы через материал байт-в-байт
(см. «Независимый разбор» ниже), только обновлены SHA коммитов из-за двух
обязательных ребейзов на ушедший вперёд `dev` (слияние #1117/#1118, затем ещё
раз после дальнейшего продвижения `dev`), плюс сам документ `CODE-REVIEW-1116-r1.md`
закоммичен в ветку публикатором и `docs/reviews/INDEX.md` пересчитан.

Обслуживаемая строка SCOPE и контракт AC1–AC3 не менялись — см. `docs/reviews/CODE-REVIEW-1116-r1.md`
(раздел «Скоуп»), унаследовано без повторного пересказа.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` целиком (тело issue, хендофф раунда 2,
`ciEvidence`), затем через `run_check`:
- `read:log` — подтверждён пятикоммитный диапазон текущего материала (выше).
- `read:diff` — полный `dev`→`candidate` дифф прочитан целиком построчно (891
  строк, обе части). Подтверждено: `docs/reviews/SPEC-REVIEW-1120-r1.md` в
  этом диффе вообще не упоминается (не создаётся, не удаляется, не правится) —
  то есть относительно текущей базы `dev` файл не тронут вовсе.
- `read:base:docs/reviews/INDEX.md` — база уже содержит строку `#1120` и
  заголовок «Документов: 221, issue: 107»; кандидат добавляет ровно одну
  строку `#1116` и заголовок «222, issue: 108» — разница ровно +1/+1, без
  побочной потери.

Дополнительно независимо от `read:diff`:
- `Glob docs/reviews/*.md` вернул 223 файла (включая сам `INDEX.md`), то есть
  222 документа без него — совпадает с заявленным в заголовке `INDEX.md`
  числом, подтверждено пересчётом по факту, а не доверием к тексту.
- `Grep #1120`/`Grep #1116` по `INDEX.md` — по одному вхождению каждое, без
  дублей от двух «index после сдвига каталога» коммитов.
- Прочитаны целиком текущие `scripts/continuation-discovery.mjs` (78 строк) и
  начало `scripts/workflow-continuation.mjs` — построчно идентичны версии,
  которую построчно разбирал r1 (`boundedJson`, `discoveryJsonRead`,
  `continuationDiscovery`, `writeSummary`, `resumeDomainContinuation` и
  остальные claim/epoch-функции не задеты).
- Прочитан целиком `test/continuation-discovery.test.mjs` (все 7 тестов) и
  изменённый кусок `test/proof-loop-856.test.mjs` через `read:diff` — те же
  кейсы, что разбирал r1: интерфейс ретраев/дедлайна (`calls===3`,
  `pauses=[100,400]`), терминальные HTTP/JSON/UTF-8/размер/cancellation-кейсы,
  CLI-уровневый негативный свидетель («failed discovery must reach no
  gh/git/dispatch command», `existsSync(marker)===false`).
- `docs/STATUS.md` — текущая строка `Tests` показывает `Node unit 5841`,
  совпадает с диффом (`5834→5841`, те же +7 новых `test(...)` из
  `continuation-discovery.test.mjs`, что и в r1); число проверено `Grep` —
  единственное вхождение в репозитории.

Исполняемые гейты: переиспользован referenced зелёный validate-gate на точном
материале SHA `4e6eae15b7d515531d0561226a8af6b5e32c28dd`
(https://github.com/Matysh/houseplan-card/actions/runs/40783946893, «review-light
proof is complete») — он покрывает build/typecheck/tooling-профиль, включая
`test/continuation-discovery.test.mjs`, `test/proof-loop-856.test.mjs`,
`test/release-read-retry.test.mjs`, `test/merge-continuation-882.test.mjs` и
`test/ci-registry-inputs.test.mjs` на этом SHA. Дополнительных `unit:test/*`/
`build:*`/`smoke:*` через `run_check` не запускал: код этих файлов байт-в-байт
не изменился относительно материала r1 (подтверждено чтением выше), входы/
окружение/oracle для них не поменялись — повторный прогон не даёт нового
сигнала (правило «новый SHA после review/docs сам по себе не отменяет
доказательство», §8). Единственный новый артефакт этого раунда —
`docs/reviews/INDEX.md`/`CODE-REVIEW-1116-r1.md` — проверен чтением и
пересчётом (`Glob`/`Grep` выше), для него нет соразмерного исполнимого oracle
(генератор `reviews-index.mjs` не менялся этим диффом, его корректность не
предмет этой задачи).

## Независимый разбор (до сверки с хендоффом)

Повторно проследил код `continuation-discovery.mjs` и вызывающий путь в
`workflow-continuation.mjs` на текущем материале, не опираясь на текст r1:
двух GET (`event-run`, `artifact-list`) достаточно, `endpointPattern` отсекает
любой третий; `boundedJson` проверяет `response.ok` до чтения/парсинга тела
(точечный фикс первопричины «unexpected end of JSON input» для HTTP-ошибок с
битым/пустым телом); ретраи только для `transportFailed`/`UND_ERR_SOCKET`
через существующий `retryingReadFetch` (#921, не изменён), HTTP/JSON/UTF-8/
размер/cancellation — терминальны без повторной попытки; `writeSummary`
вызывается в `catch` блоке `continueWorkflows` до `throw`, то есть
`summary.json` гарантированно существует до любого `gh`/`git`/claim/dispatch
вызова в цикле `for (const artifact of candidates)`, который физически стоит
ниже. Это ровно то же поведение, что независимо разобрал r1 — новый разбор
подтверждает, а не просто повторяет его выводы, поскольку код на этом SHA
идентичен файлу, который читал r1 (сверено построчно, см. «Как проверялось»).

Единственное содержательное отличие от материала r1 — документальный слой:
`docs/reviews/CODE-REVIEW-1116-r1.md` теперь закоммичен в самой ветке (это
штатная публикация отчёта раунда 1, несущая `hp:review-publication-receipt`),
и `docs/reviews/INDEX.md` пересчитан после двух ребейзов. Разобрал оба
ребейза по описанию хендоффа (конфликты `docs/STATUS.md`/`docs/DEVELOPMENT.md`/
`ci-registry-inventory.json` из-за параллельно смержившихся #1117/#1118) и по
факту: `read:diff` относительно текущего `dev` показывает ровно ожидаемые от
этой задачи правки (см. список файлов в CODE-REVIEW-1116-r1.md, не изменился)
плюс сам r1-документ и пересчитанный `INDEX.md` — никаких посторонних
docs/STATUS/ledger строк, не относящихся к #1116, в диффе нет.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, в скоупе) — диф #1116 удалял `docs/reviews/SPEC-REVIEW-1120-r1.md` и занижал счётчики `docs/reviews/INDEX.md` на 1/1 | Обязательный ребейз ветки на ушедший вперёд `dev` (после слияния #1117/#1118) вынес задачу на новую базу, где `SPEC-REVIEW-1120-r1.md` и его строка в `INDEX.md` уже приняты и не являются частью диффа #1116; `INDEX.md` пересчитан штатным генератором до фактического состояния | `read:diff` на `4e6eae15b…`: файл `docs/reviews/SPEC-REVIEW-1120-r1.md` вообще не упоминается (не создаётся/не удаляется/не правится); `read:base:docs/reviews/INDEX.md` показывает строку `#1120` и «221, issue: 107» уже в базе; кандидат — «222, issue: 108» (ровно +1 за счёт новой строки `#1116`); `Glob docs/reviews/*.md` = 223 файла (222 без `INDEX.md` самого) — совпадает с заголовком |

## Унаследовано из r1

Принято без повторного исполнения — код и тесты на этом SHA байт-в-байт
совпадают с тем, что разбирал и запускал r1 (сверено в этом раунде чтением,
см. выше), входы/окружение/oracle не изменились:

- Независимый построчный разбор `continuation-discovery.mjs`/
  `workflow-continuation.mjs` (структура `step`, `safeReason`, retry-границы,
  `writeSummary` до `throw`) — `docs/reviews/CODE-REVIEW-1116-r1.md`, раздел
  «Независимый разбор кода», материал `57b9a5ea0f84914fbb37394450c53a5bbd629aa9`.
- Таблица AC1–AC3 «чем доказан/чем краснеет» и её исполняемые свидетели
  (`test/continuation-discovery.test.mjs` 7/7, `test/proof-loop-856.test.mjs`,
  `test/merge-continuation-882.test.mjs`, `test/release-read-retry.test.mjs`
  30/30) — та же секция того же документа, тот же referenced validate-gate
  (ранее `40775892115` на r1-материале, сейчас `40783946893` на r2-материале;
  код тестов не изменился, см. «Как проверялось»).
- Проверка `.github/workflows/validate-product.yml`/`validate-tooling.yml`,
  `scripts/ci-profile-paths.json`/`ci-registry-inventory.json`,
  `docs/release-ledger/v1.82.0/1116.json` («infra», без `milestone`) — та же
  секция «Что проверено и корректно» r1; дифф этих файлов не изменился в r2
  относительно описанного там (кроме тривиального включения в пересчитанный
  общий `ci-registry-inventory.json`, не относящегося к #1116 по содержанию).
- «Чего не проверял» r1 (полные сообщения коммитов с трейлерами `Issue:`/
  `User-Visible:` — доступный `read:log` отдаёт только oneline-форму и в этом
  раунде; историческая первопричина job `122872614664`; `build:*`/`smoke:*`)
  остаётся актуальным и в r2 без изменений оснований.

## Что проверено и корректно (дополнительно к унаследованному)

- `docs/reviews/INDEX.md` — счётчики и ровно одна новая строка `#1116`
  соответствуют фактическому набору файлов (`Glob`/`Grep`, см. выше), без
  регрессии по `#1120` или дублей.
- `docs/reviews/CODE-REVIEW-1116-r1.md` в репозитории побайтно содержит
  исходный r1-документ с его publication-receipt — не переписан, не урезан.
- Пять коммитов диапазона (`read:log`) — ровно: fix, test, публикация
  r1-отчёта, два пересчёта индекса после двух ребейзов; docs-only коммиты
  (индекс/отчёт) по правилу AGENTS.md не требуют трейлеров `Issue:`/
  `User-Visible:` (класс C).

## Чего не проверял

- Полные сообщения всех пяти коммитов (трейлеры) — тот же недоступный
  `check_id` (нет `git log --format=fuller` в манифесте), унаследовано из r1.
- Содержимое `docs/reviews/CODE-REVIEW-1116-r1.md` по существу повторно не
  пересматривалось отдельной сверкой текста — только факт его присутствия и
  неизменности байт-в-байт против диффа.
- `unit:test/*`, `build:*`, `smoke:*` через `run_check` в этом раунде не
  запускал — обоснование выше («Исполняемые гейты»): код не изменился, новый
  referenced validate-gate (40783946893) покрывает тот же профиль на точном
  r2-материале.

## Гейты — что прогнано, что нет и почему

- `read:log`, `read:diff`, `read:base:docs/reviews/INDEX.md` — выполнены
  через `run_check` в этом раунде (см. «Как проверялось»).
- `Glob`/`Grep` по `docs/reviews/*.md` и `INDEX.md` — выполнены напрямую,
  независимая проверка счётчиков.
- Переиспользован зелёный validate-gate на точном материале SHA
  `4e6eae15b7d515531d0561226a8af6b5e32c28dd`:
  https://github.com/Matysh/houseplan-card/actions/runs/40783946893
  («review-light proof is complete») — покрывает build/typecheck/tooling
  unit-профиль; новых входов/окружения/oracle относительно r1 не появилось.
- `build:*`/`smoke:*`/`unit:test/*` из манифеста — не прогонялись отдельно в
  этом раунде: диффу не нужны (нет фронтенд/бандл/продуктовых изменений), а
  затронутые unit-файлы байт-в-байт не изменились относительно r1-материала,
  где они уже были прогнаны и зафиксированы (7/7, 30/30).

## Побочные находки вне скоупа

Побочных находок Medium вне скоупа этой задачи не обнаружено за время
разбора. Политика `REVIEW_FINDINGS_POLICY` в этом раунде — `mode: issues`
(round 2) — `outside_findings` пуст, новых issue не заводится.

## Материал раунда

- Ветка: `issue/1116-continuation-read`, диапазон `read:log`: `5441944a4`,
  `75a1a2eaf`, `c7e30647a`, `a4f829c19`, `4e6eae15b`.
- Материал: `4e6eae15b7d515531d0561226a8af6b5e32c28dd`, дерево
  `1036424ca1cd306c4df7d7f012ed8c1d88348fa2`.
- Тело issue: `e7415ce37993ba0b191b58c4eed491a8fdeb59c6996302a11c84c489850d5085`.
- Вердикт: зелёный · High 0 · Medium 0 · маршрут `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjM2NjEzNGMyNDIzYzNlNWFjOTdlOGY2NDAyMzI5MTQ3N2QwZTgwNGJjMjIyYjY2OTEyZWM3MDU5Y2E0MjNjYzQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwYzBkOGQwZGM0MjU1ODA0MmE5OTlhZDEyYTU1YjQ0YjQ4ZTViMGZjODYwNGYwMGRhZWM1ZDQ2NGEyMTI0ZGRhIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE2LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI0ZTZlYWUxNWI3ZDUxNTUzMWQwNTYxMjI2YThhZjZiNWUzMmMyOGRkIiwidHJlZSI6IjEwMzY0MjRjYTFjZDMwNmM0ZGY3ZDdmMDEyZWQ4YzFkODgzNDhmYTIiLCJib2R5RGlnZXN0IjoiZTc0MTVjZTM3OTkzYmEwYjE5MWI1OGM0ZWVkNDkxYThmZGViNTljNjk5NjMwMmExMWM4NGM0ODk4NTBkNTA4NSIsInByb2R1Y2VyUnVuIjoiNDA3ODQ3NDQxMjYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImUwYTQyYWQ3NzVhOGRjNWZjZGEzMDk2YTNkYjgwZjAyMDNiZWIxMzMxOTQ5ODM0MzVlOTYwYjdlN2Y3NDY5MzYiLCJ2ZXJkaWN0RGlnZXN0IjoiZjk1ZDk5MjUwODg1NjY4MjY0OTA1Mzc2YTY5NGZkM2FkNjVmOThlNTBhZGE0YzI4YzkyMWNiOWI2MTcwZjMzMSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI2OWFjMTAzY2I0NzRiMTA5YjJjN2VmY2UzNGFlYmRmMmU0MmY3NjhhN2M0ZTk5ZWQ0MmNmMzAyZDFhNjQ3MjMyIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgzMTIyMDMwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE2I2lzc3VlY29tbWVudC02NDgzMTIyMDMwIiwiYm9keURpZ2VzdCI6IjYzMTAzMmJmM2ZkOTQ5YmU0YmZiYWFkZTZjNjg5YzUxMWM0ZjI4Mjg0YzRkZjM0MTVjZjQ4ZGJlNDcxY2YzZWQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1116-continuation-read`, коммит `4e6eae15b7d5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1036424ca1cd306c4df7d7f012ed8c1d88348fa2`
  ```
  git log --all --format='%H %T' | grep 1036424ca1cd
  ```
- Тело issue: `e7415ce37993ba0b191b58c4eed491a8fdeb59c6996302a11c84c489850d5085`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40784744126,"run_attempt":1,"digest":"27ba2880d517adfb78f4f7a92987b7485ca306a7152a021575b90bbf1dac3f34"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTIsIm91dHB1dF90b2tlbnMiOjE5MTcyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyOTc2NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI0MjcwMjUsImNvc3RVc2RFc3RpbWF0ZSI6MS4xOTYyOTd9XSwidHVybnMiOjM2LCJkdXJhdGlvbk1zIjoyNjg4NjYsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjE5NjI5NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=52 output_tokens=19172 cache_creation_input_tokens=129767 cache_read_input_tokens=2427025 num_turns=36 -->
