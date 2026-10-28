# CODE-REVIEW — issue #1114 (заход r1)

Материал: `e5cc24c0fa5674e9b23298a1f307cb3971dc27aa` (ветка `issue/1114-golden-unchanged-checks`, база `dev@31b17bec0`).
Трек: show. Этап: code. Блокирующих циклов: 0/2.

## Скоуп

Issue #1114 — узкий инфраструктурный ремонт (класс B/C, PROCESS §1): добавляет
`visual.goldenChecks` (требует `visual.schema: 2`) — явный per-task выбор уже
принятых Golden-сцен, которые должны остаться строго неизменными (byte-identical
PNG, `differingPixels=0`, `diffRatio=0`), отдельно от `visual.golden`
(намерение пиксельной дельты `change`/`new`). Цель — закрыть пробел,
из-за которого #1097/#1098 не могли объявить «эти кадры не меняются» без
фиктивного `change`. Продуктовый код, рантайм, HA-контракт, jobs/триггеры,
default/full routing и политика приёмки baseline не затронуты.

Изменённые файлы (ровно список из материала): `scripts/task-intent.mjs`,
`scripts/task-visual-intent.mjs`, `scripts/browser-push-plan.mjs`,
`scripts/browser-plan-proof.mjs`, `scripts/browser-selected.mjs`,
`scripts/task-ci-plan.mjs`, `scripts/mutation-registry.mjs` (5 новых witness),
`scripts/ci-profile-paths.json`, `scripts/ci-registry-inventory.json`,
`test/golden-unchanged-checks.test.mjs` (новый, 11 тестов),
`test/task-check-reuse.test.mjs` (+1 тест), `test/data/golden-unchanged-scopes.json`
(новый, данные реального replay #1097/#1098), `PROCESS.md`, `docs/DEVELOPMENT.md`,
`docs/process/AUTHOR.md`, `docs/STATUS.md`, `docs/analysis/1114-golden-check-plans.json`,
`docs/analysis/1114-golden-checks-2026-10-28.md`, `docs/release-ledger/v1.82.0/1114.json`,
`.github/workflows/validate-product.yml`, `.github/workflows/validate-tooling.yml`.

## Как проверялось

Static-first: прочитан весь список изменённых файлов (не только диффы — полный
текст `task-intent.mjs`, `task-visual-intent.mjs`, `browser-push-plan.mjs`,
`browser-plan-proof.mjs`, `browser-selected.mjs`, `task-ci-plan.mjs`,
`task-check-reuse.mjs` — последний не менялся, но реюзает `browserPlanExecution`
для новой expectation `unchanged`, что я проверил отдельно), плюс полный
`read:diff` материала (1485 строк) и `read:log` (2 коммита). Прослежен путь
вызова: `validateVisualIntent` → `readTaskIntent`/`readTaskVisualIntent` →
`browserPushPlan` → `browserPlanExecution`/`normalizeTaskCheckScope` →
`browser-selected.mjs` (воркер) → `task-check-reuse.mjs` (receipt/key).

Независимое исполнение (не повтор уже пригодного proof, а адресная проверка
конкретных файлов/рисков, которых проверка CI уже коснулась, но которые я
трассировал по коду самостоятельно):
- `unit:test/golden-unchanged-checks.test.mjs` — PASS (exitCode 0, 11/11).
- `unit:test/task-check-reuse.test.mjs` — PASS (exitCode 0, вкл. новый тест #1114).
- `unit:test/browser-push-plan.test.mjs` — PASS (регрессия на основной модуль не внесена).
- `unit:test/task-visual-intent.test.mjs` — PASS (регрессия на схему/epoch-чтение не внесена).
- `static:mutation-registry` — PASS (все 1997 определений, включая 5 новых
  `golden*1114` witness, статически валидны: find-паттерны существуют в указанных файлах).
- `read:log`, `read:diff` — прочитаны полностью для независимой трассировки диффа.

Переиспользовано (не повторялось): validate-gate зелёный прогон
(https://github.com/Matysh/houseplan-card/actions/runs/40703310680,
"review-light proof is complete") покрывает `gate:small`, `process --range
origin/dev..HEAD --issues` (2 коммита, трейлеры Issue/User-Visible), normal
hook (GREEN/0 failed на финальном материале), exact-head CI (docs/tooling
SUCCESS на `e5cc24c0`), а также авторский прогон 134/134 по семи файлам и
96/96 по четырём целевым файлам до правки версии схемы. Эти прогоны не
повторялись — для них нет изменившихся входов/окружения/oracle с момента
зелёного прогона.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (валидация декларации: unknown/duplicate/empty/wrong-schema/epoch отказывают) | `test/golden-unchanged-checks.test.mjs` (тесты «strict checks require a reader version…», «checks reject malformed IDs/reasons…», «check declarations never become pending…») — перепрогнан PASS | Обычный негативный ввод в этих тестах (malformed id, пустой reason, дубликат id, `schema:1`+`goldenChecks`, `expectation` внутри check, неверная epoch baseline) — red на неисправленной базе подтверждён автором (66/9 до правки); witness `golden-strict-declaration-validation-bypassed-1114` зарегистрирован, не исполнялся |
| AC2 (строгая неизменность: pixel diff/sha mismatch/error/partial/child-failure не проходят; pending delta не ослабляет) | `test/golden-unchanged-checks.test.mjs` («unchanged requires byte identity…», «pending change/new can never weaken…», «the actual selected worker retains child/partial-output failure…») + `test/task-check-reuse.test.mjs` («a strict unchanged receipt cannot reuse tolerant or delta coverage…») — перепрогнан PASS | Обычные негативные case'ы (differingPixels=1, sha mismatch, status=different/missing-baseline, child exit≠0/signal/error, пустой results, смешанная pending expectation) в тех же тестах; witness `golden-strict-check-allows-tolerated-difference-1114`, `golden-strict-check-inherits-pending-delta-1114`, `golden-strict-contract-claims-full-coverage-1114`, `golden-strict-check-silently-expires-1114` зарегистрированы, не исполнялись |
| AC3 (read-only replay #1097/#1098 даёт bounded plan без global mappings/full matrix; документация; gate:small/process/inventory/CODE) | `test/golden-unchanged-checks.test.mjs` («recorded real render-source scopes stay bounded…») на `test/data/golden-unchanged-scopes.json` (реальные файлы/labels/render двух задач) — перепрогнан PASS; полные планы в `docs/analysis/1114-golden-check-plans.json` (6/4 отобранных сцены, `unresolved` = core-файлы без прямой мэппинг-связи, что ожидаемо и не расширяет глобальные связи) | Обычный ввод без `goldenChecks` для тех же scope продолжает отказывать `/Task visual scope is not declared/` (проверено тем же тестом и зафиксировано в raw replay `noChecksError`) |

## Что проверено и корректно

- Схема версионирования: `schema:1` сохраняет прежнее поведение без `goldenChecks`
  (даже пустой массив требует `schema:2`) — закрывает обнаруженную автором
  дыру совместимости (молчаливое игнорирование чека старым ридером при
  `files=[]`/`render=false`). Проверено чтением `task-intent.mjs` и тестом
  «strict checks require a reader version that cannot silently ignore them».
- `goldenChecks` физически не может попасть в `visual.golden`/pending
  acceptance: `readPendingVisualIntents` строит `golden` только из
  `intent.golden`, никогда из `intent.goldenChecks` — проверено чтением
  `task-visual-intent.mjs` и тестом на expectChange/expectNew.
- Конфликт same-scene: check vs own `golden`, check vs cross-task pending
  delta — оба пути explicit throw в `browser-push-plan.mjs`, независимо от
  того, что `validateVisualIntent` уже не допускает id-пересечение внутри
  одного visual-объекта (двойная защита, не баг).
- `selectedGoldenPassed` для `expectation==='unchanged'`: требует `status
  ==='passed'`, точное совпадение SHA256, `differingPixels===0`,
  `diffRatio===0` — обычный tolerance (`differingPixels>0`) больше не
  проходит для этой ветки, при этом старые tolerant/`change`/`new` пути
  побайтово сохранены (отдельная ветка `return result.status==='passed' ||
  …`).
- `browserPlanExecution` допускает `expectation:'unchanged'` только когда
  `isTaskBrowserPlan(plan) && plan[kind].mode==='selected'` — full/unscoped
  push не может пронести строгий контракт; legacy wire
  (`scope:'push', coverageScope:'task'`) совместим. Проверено чтением и
  тестом «internal unchanged survives the legacy task wire…».
- Receipt/key: `task-check-reuse.mjs` не менялся, но корректно получает новую
  семантику через `normalizeTaskCheckScope`→`browserPlanExecution`; expectation
  входит в `scope.golden.intent`, следовательно в `planKey` — старый
  tolerant/`change`/`new` receipt с тем же id не проходит verifyTaskCheckClaim
  для нового строгого плана (отдельно проверено тестом с 4 разными ключами
  для null/`change`/`new`/`unchanged`).
- `ci:full`/`baseFull` с объявленными `goldenChecks` отказывают явно в обоих
  местах входа (`browser-push-plan.mjs` и `task-ci-plan.mjs`), включая случай,
  когда `goldenChecks` объявлены в ledger, но явный `visualIntent` в опциях
  пуст (наследование через `readTaskIntent`).
- Инфраструктурные файлы (`ci-profile-paths.json`, `ci-registry-inventory.json`,
  workflows paths-filters) — только добавление путей новых тестов/ledger-файла,
  без изменения jobs/триггеров. Подтверждено диффом.
- `docs/release-ledger/v1.82.0/1114.json`: category `infra`, без
  `introducedBy` (не правка бета-фичи) — корректно соответствует характеру
  задачи; не входит в пользовательский milestone.
- `docs/STATUS.md`: прирост счётчика тестов (5794→5806, +12) согласуется с
  11 новыми тестами в `golden-unchanged-checks.test.mjs` и 1 новым в
  `task-check-reuse.test.mjs` — пересчитано вручную, расхождений нет.
- User-Visible: no обоснованно — продуктовый рантайм/UX не меняется;
  changelog не трогался, что и ожидается.

## Чего не проверял (и почему не требовалось)

- Полный `npm test`/`gate:small`/tsc-build заново — покрыто зелёным
  validate-gate на этом же SHA; материал/окружение/oracle с тех пор не
  менялись, общий повтор не является заменой адресной проверки (следовал
  явному указанию не использовать общие прогоны как запасной сценарий).
- Исполнение браузерных Golden-захватов для #1097/#1098 — вне скоупа: #1114
  это planner/metadata-уровень, реальные свежие кадры и их CI — ответственность
  тех задач после ребейза на принятые хелперы (явно описано в handoff и
  AUTHOR.md).
- Полные тексты Issue/User-Visible трейлеров двух коммитов — нет доступного
  check'а для чтения полного commit message (только `read:log`
  oneline/`read:diff`); опираюсь на покрытый зелёным validate-gate
  `process --range origin/dev..HEAD --issues` (2 commits, PASS) — не
  переисполнялось отдельно, т.к. нет пригодного инструмента и материал не
  менялся.
- Мутационное исполнение (ночной прогон) — не запускалось намеренно;
  статическая регистрация подтверждена (`static:mutation-registry` PASS),
  исполнение мутантов вне ночного workflow запрещено политикой.

## Побочные находки

Вне scope #1114 ничего не найдено — просмотренный код (task-check-reuse.mjs,
browser-plan-proof.mjs) используется строго по месту задачи, новых
проблем в соседнем коде не обнаружено.

## Вердикт

**green.** Все 3 AC независимо прослежены по коду и подтверждены
перепрогнанными unit-тестами (без повтора уже пригодного зелёного proof для
непострадавших частей); негативные/защитные сценарии задокументированы в
таблице выше с конкретным красным свидетелем (обычный тест или
зарегистрированный witness). Находок High/Medium в скоупе нет.

Маршрут: **fix** (критерии §5 для track:show не нарушены — сложность и риск
низкие, одна поверхность — CI planner/metadata модуль, миграций
конфигов/compatibility-полей продукта нет, нового UX-контракта нет, влияния
на производительность/touch нет, поведение зафиксировано в PROCESS.md/
docs/DEVELOPMENT.md/docs/process/AUTHOR.md тем же коммитом).

Гейты: прогнаны целевые unit-тесты четырёх изменённых/связанных файлов и
статическая проверка registry (см. «Как проверялось»); переиспользован
зелёный validate-gate для gate:small/process/inventory/normal-hook/exact-head
CI — не повторялись, т.к. нет изменившихся входов. Полные предрелизные
наборы не запускались — несоразмерны объёму задачи (PROCESS §8).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjljMTNjOGE2NTYwNDZlODRlMmQ3ODlkMGFkYjg1ZTc0Yjg5NmRkNzYxMmE0MWM0NTQ0ZmVmNDY0YTUxMTYwYTUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2NWUzYzVjMWVhYTkxYmU4NDIwMDY0NTA5ODY0MjIwYWM4MmM2NDM4NDBhNTVjZGQ2MWIwY2QyNTRhNWQ3ZjU2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJlNWNjMjRjMGZhNTY3NGU5YjIzMjk4YTFmMzA3Y2IzOTcxZGMyN2FhIiwidHJlZSI6IjkzODI0OTBjYWQwMGVkMTliYTcyMjQ5MzMzODkyNjIyZTI1Nzc3YTYiLCJib2R5RGlnZXN0IjoiNzNmODQwOGFhMDhmNjUxZmY4NDFjOTA3YTcyMWYzN2IyN2MwZDE3ZGY3ODk1MzdjMTQ0OTg0OTYxZmFlOTAzOCIsInByb2R1Y2VyUnVuIjoiNDA3MDQ1Nzg2NzMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImQxY2FjYWFiMjYxYzZmYWE1YzkzNWYxMDIzYWQ4MTIwMDU5ZmVmMDI5NzY1MDc5YTgwMzEzZWIwNWU5MjdmYzMiLCJ2ZXJkaWN0RGlnZXN0IjoiZmJhNGVhODIxZjExOTZlMzE2OGQzM2E2ODg2Y2IyN2Q2NDVjZDhlNDEyNzQ5ZWU0MWY1N2YzZmM4ZTk1YjBmYyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1ZWMxNTI2OWRlMjkzMmM0YWQ5ZDVlMGRiYTFiMjhiODlhZDE1MTQwZDNhNDYyZTU1ODY4NGQxZDQ4ODYzZjUzIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDcxNjYxNjI5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE0I2lzc3VlY29tbWVudC02NDcxNjYxNjI5IiwiYm9keURpZ2VzdCI6IjZkMGZkZTM1OTY4MjZkMjUxZTEwZDhmMDEzYTg3ZTg5ZGI3YzhlYzNmYjQzYzBlMzI3YzI1MWY2YTE0OWExMWYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1114-golden-unchanged-checks`, коммит `e5cc24c0fa56` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9382490cad00ed19ba72249333892622e25777a6`
  ```
  git log --all --format='%H %T' | grep 9382490cad00
  ```
- Тело issue: `73f8408aa08f651ff841c907a721f37b27c0d17df789537c144984961fae9038`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40704578673,"run_attempt":1,"digest":"8140787edad4a076a451e32523399bd6cca8ca06960a93d9d287b0ba1737b9f5"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjAsIm91dHB1dF90b2tlbnMiOjI3MDQxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2Mjk1MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI2ODQzMzIsImNvc3RVc2RFc3RpbWF0ZSI6MS40NTkyMDQ0MDAwMDAwMDAyfV0sInR1cm5zIjo0MywiZHVyYXRpb25NcyI6MzYyNzIxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40NTkyMDQ0MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=60 output_tokens=27041 cache_creation_input_tokens=162952 cache_read_input_tokens=2684332 num_turns=43 -->
