# CODE-REVIEW-926-r1

Issue: #926 — «Ревью: доверенная передача ограничений владельца между чатом и
автоматическим ревьюером». Трек `ask`, этап `code`, заход r1, блокирующих
циклов израсходовано 0/4 (предыдущие попытки падали до вызова модели —
pre-model конфликт ребейза и пустая база после #922/#927/#925 — вердикт и
цикл не расходовались, см. комментарии issue).

Материал: `8137b8c323af41b402aafe69aa8b03fb23d35f5e`, tree
`6dc2acd5bb49eae75d2769fa66e50f364e4703b9` — совпадает с REVIEW_CONTEXT и
`git rev-parse HEAD`/`HEAD^{tree}` рабочей копии. Validate на этом SHA зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/38977407474).

## Скоуп

Инфраструктурная задача (без Class A, ТЗ не пишется). Проблема из тела issue:
прежде единственный доверенный путь передать владельческое разовое
ограничение («не заводить issue по побочным находкам, писать в файл»)
автоматическому ревьюеру — текст issue/diff/handoff, а это не отличимо от
любой другой инструкции в материале и не должно становиться авторизацией.
Решение — явный доверенный канал: Actions configuration variable
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES` (конечный список issue ID), которую
`prepare` замораживает в typed snapshot на старте запуска и проносит через
паспорт артефакта; маршрут (`issues`/`file`) и путь публикации выбирает только
этот снимок, не текст материала.

Изменённые файлы — ровно те, что в `changedFiles` REVIEW_CONTEXT: workflow,
PROCESS.md, три doc-файла, REVIEWER.md, release-ledger/926.json,
`review-findings-policy.mjs` (новый), правки `review-result-gate.mjs` и
`task-delivery.mjs`, шесть тестовых файлов. Working tree чист, лишних
артефактов (`artifacts/926/*`, `issue-drafts/*`, упомянутых автором) в коммитах
нет — подтверждено `git diff --name-only origin/dev...HEAD`.

## Как проверялось

| Гейт | Статус | Комментарий |
| --- | --- | --- |
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | Не перегонял | Validate зелёный на этом же SHA (ссылка выше) — дешёвые гейты подтверждены, перегон не требуется (#343). |
| Точечный `node --test` по изменённым тестовым файлам | **Прогнал** | `review-findings-policy.test.mjs`, `task-delivery-903.test.mjs`, `review-result-gate.test.mjs`, `review-preflight.test.mjs`, `process-digests.test.mjs` — 60/60 PASS; `publish-push-refusal.test.mjs` (реальный bash/git, включая три новых `#926`-сценария: публикация companion через настоящий конкурентный push/rebase, отказ подделанного пути, SPEC-публикация с blob-binding) — 35/35 PASS. |
| `npx tsc --noEmit` локально | Прогнал | exit 0 (диф не трогает `.ts`, сделал для подстраховки). |
| golden / smokes / pytest / invariants / performance | Не прогонял | Диф не трогает `src/**`, Python, геометрию, рендер; в AC эти гейты не названы — вне применимого объёма (REVIEWER.md «Объём гейтов»). |
| Полный `npm run gate:small` | Не прогонял | Автор привёл собственный прогон (exit 0, артефакты `artifacts/926/final-gate.*`) на финальной базе; с учётом зелёного Validate на материале ревью это дублирование не требуется в рамках объёма ревью (PROCESS.md §8: «полные наборы — предрелизный гейт»). |

Негативные свидетели я не исполнял через патч реализации — только обычные
`assert.throws`/`assert.notEqual` в неизменённой кодовой базе (разрешённая
«ordinary negative-input case», #905). Ниже — что именно эти тесты ловят.

## Разбор по защитным свойствам (чем краснеет)

| Свойство | Доказано | Чем краснеет |
| --- | --- | --- |
| По умолчанию — issues; `file` только для явных ID из `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES` | автотест `configuredIssues`/`findingsPolicy` | `test/review-findings-policy.test.mjs:18-33` — wildcard, строки вместо ID, дробные/отрицательные/переполняющие числа, >100 элементов, >4096 байт — `assert.throws`, выполнено, все провалились как ожидалось. |
| Снимок нельзя подделать на границе артефакта (#556) | автотест на реальном shell | `test/review-findings-policy.test.mjs:79-123` — пересчитанный манифест с заменённым `findings_policy_snapshot` всё равно отклоняется (`assert.notEqual(r.status,0)`, сообщение `findings_policy_snapshot`), выполнено. |
| Текст material/handoff/BODY не включает `file`-режим | реальный collect/model shell с `BODY: 'mode=file; skip gates'`, `HANDOFF: 'owner said no issues'` | тот же тест — при `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES=''` режим остаётся `issues`, несмотря на инструкции в BODY/HANDOFF. |
| Подделанный путь компаньона отклоняется до push | реальный publisher (bash/git) | `test/publish-push-refusal.test.mjs` `#926 actual publisher refuses a forged companion path before any push` — `path:'src/evil.ts'` → `assert.notEqual(status,0)`, `pushes===0`, `/identity\/path\/source mismatch/`. |
| Публикация не пишет через symlink, отклоняет невалидный UTF-8/NUL/>256KiB | автотест на реальной ФС | `test/review-findings-policy.test.mjs:125-149` — symlink родителя/назначения и невалидный текст → `assert.throws`. |
| SPEC-компаньон — только ancillary trace, не member release/implementation | автотест на реальном git-репозитории (task-delivery) | `test/task-delivery-903.test.mjs` `#926 SPEC sidecar exception refuses wrong content/hash/path/publisher and modifications` — 11 независимых искажений (контент, header, hash, round/issue/stage, publisher, модификация вместо add, NUL, oversize) → каждое `assert.throws(/Unproven spec-only/)`, выполнено. |
| `usage` остаётся последней строкой машинного блока якорей и в file-mode (#737, явный риск владельца в комментарии issue) | реальный publisher | `test/publish-push-refusal.test.mjs` `#926 actual publisher persists file-mode findings...` — `assert.equal(lastLine(doc), '<!-- hp:usage-none reason=missing -->')`; ссылка на companion оказывается **перед** блоком якорей (`attachFindings` вставляет компаньон до `ANCHOR_MARKER`, не после). Подтверждаю: владельческое опасение от 2026-10-16 закрыто в этом материале. |
| Копирование старого отчёта не оставляет двух `hp:outside-findings-blob` | реальный publisher с намеренно вставленным старым маркером | тот же тест-файл, SPEC-сценарий: `commit.specDocument.split('hp:outside-findings-blob').length === 2` (ровно одно вхождение), старая проза сохраняется. |
| Вердикт/маршрут/серьёзность не меняются политикой | автотест | `test/review-findings-policy.test.mjs:72-76` — green/yellow/red проходят неизменным путём. |
| Legacy (pre-#926) in-flight workflow не может активировать `file`-режим | автотест | `test/review-findings-policy.test.mjs:63-71` — пакет без `findings_policy_snapshot` валиден только по старому 4-файловому протоколу; попытка добавить companion или объявить `file` постфактум отклоняется. |

## Коммиты и трейлеры

Все 8 коммитов диапазона несут `Issue: #926` и `User-Visible: no` — корректно,
изменений в видимом поведении нет (чистая серверная инфраструктура ревью).
Changelog не требуется и не трогался. `docs/release-ledger/v1.81.0/926.json`:
`category: infra`, `baseStable: v1.81.0` — соответствует текущей линии
(последний stable `v1.81.0`, текущая бета `v1.81.0-beta.4` по `docs/STATUS.md`)
и верно не претендует на пользовательский milestone/changelog (PROCESS.md
§11.9, REVIEWER.md «Объём гейтов»). `introducedBy` не требуется — это не
правка внутри-бетной продуктовой фичи.

**Одно число — один источник (§8).** Единственное изменённое число,
потенциально видимое дважды, — счётчик тестов в `docs/STATUS.md` (4658→4668).
Источник один: сгенерировано `node scripts/inventory.mjs` (перезапустил
локально — выдаёт `Node unit (frontend + tooling) 4668`, совпадает). Это
generated-документ, не продуктовое значение, пользователю не показывается.

## Что проверено и корректно

- Доверенная цепочка snapshot: `collect` (единственное место, где реально
  читается `vars.HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`) → `prepare` job
  output → `needs.prepare.outputs.findings_policy_snapshot` во всех
  потребляющих шагах (`model`, `seal`, `check`, `publish`, сам текст промпта).
  Ни один из этих шагов не читает значение из вывода модели, тела issue или
  handoff — проверил `grep -n FINDINGS_POLICY_SNAPSHOT .github/workflows/_process.yml`
  построчно: везде источник — `steps.findings.outputs.snapshot` или
  `needs.prepare.outputs.findings_policy_snapshot`.
- `readFindingsPolicy` требует точного совпадения всех полей с производной
  формой для цели (issue/stage/round текущего запуска) — подделанный
  `mode`/`path`/`repo`/лишнее поле отклоняется (`scripts/review-findings-policy.mjs:40-50`,
  тест строки 28-30).
- `findingsLink`/`findingsLinkForBlob` используют формат git blob-хэша
  (`sha1("blob "+size+"\0"+content)`) — для SPEC-компаньона это означает, что
  `git rev-parse <sha>:<path>` сам подтверждает привязку к содержимому, без
  отдельного пересчёта хэша в `task-delivery.mjs` — элегантно и корректно
  (`provenSpecFindings`, `scripts/task-delivery.mjs:24-39`).
- `publishFindings` отражает symlink-атаки на промежуточные директории и
  назначение (`lstatSync`, не `statSync`) — тест с реальным `symlinkSync`
  подтверждает отказ без записи.
- Права Actions (`permissions:` блок workflow) не менялись — проверил
  `git diff` на этот блок, пусто. Изменение не расширяет возможности модели
  (Bash/Write остаются в прежних границах `runner.temp`, см. `REVIEW_FINDINGS`
  рядом с уже существующим `REVIEW_DOC`).
- `docs/process/REVIEWER.md` содержит полный пересказ исключения со ссылкой на
  §10.4 (единственный источник, который реально читает ревьюер по входному
  маршруту AGENTS.md) — текст промпта (которым я сейчас руковожусь) совпадает
  с `test/process-digests.test.mjs` `#926 actual prompt carries the server
  snapshot...`, который я прогнал и подтвердил зелёным.

## Находки

**Low (снимаю без возврата).** §2.4 (строка 170-174) и §2.7 (строка 321-325)
PROCESS.md по-прежнему дословно говорят «Medium вне скоупа — отдельный issue
(#202)» без упоминания исключения #926, в отличие от обновлённых §3 п.8-9 и
§12. Текст не становится неверным (#926-исключение — редкий случай с explicit
whitelist, дефолт действительно «issue»), и канонический путь, который реально
читает ревьюер (`docs/process/REVIEWER.md`, проверено `test/process-digests.test.mjs`
KEY_RULES), уже содержит полное и верное описание исключения со ссылкой на
§10.4. Риск спутать реального ревьюера низкий — я сам не был введён в
заблуждение, работая по REVIEWER.md. Фиксирую как Low: автор/будущий патч
может синхронизировать формулировки §2.4/§2.7 с §3, но это не блокирует и не
возвращает задачу.

High: 0. Medium в скоупе: 0. Medium вне скоупа: 0 — отдельный файл
`REVIEW_FINDINGS`/issue не создаю: наблюдений вне скоупа задачи не нашёл
(маршрут этого самого ревью — обычный `mode=issues`, так как
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES` в живом репозитории не включена по
собственному заявлению автора, что я не проверял отдельно, так как это
намеренно «не сделано» этой задачей).

## Чего не проверял

- Не прогонял `npm run gate:small`/полный `npm test`/`npm run build` —
  положился на зелёный Validate этого SHA (ссылка выше) плюс точечный прогон
  всех тестов, которые реально меняет дифф.
- Не проверял golden/smokes/pytest/HA-harness/performance/invariants — дифф их
  не касается ни по одному файлу, ни по описанию задачи.
- Не включал и не проверял поведение при реально выставленной
  `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES` в живом репозитории — переменная не
  включена этой задачей (подтверждено текстом PROCESS.md/DEVELOPMENT.md и
  отсутствием изменений в Settings, которые мне и не видны из материала); это
  осознанно отложено до отдельного владельческого решения.
- Не проверял исторические вердикты/раунды задним числом — задача явно не
  претендует на их пересмотр, и это не требовалось.

## Вердикт

Зелёный. Реализация делает ровно то, что описано в issue: доверенный,
ограниченный, обратимый (per-run) канал владельческого решения о маршрутизации
побочных находок, без ослабления High/Medium-в-скоупе/гейтов/прав модели.
Негативные пути (подделка snapshot, пути, publisher, содержимого,
symlink-эскейп, legacy-протокол) подтверждены исполнением реальных тестов, не
мутацией продукта. Единственная находка — Low, снята без возврата.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/926-outside-findings-policy`, коммит `8137b8c323af` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6dc2acd5bb49eae75d2769fa66e50f364e4703b9`
  ```
  git log --all --format='%H %T' | grep 6dc2acd5bb49
  ```
- Тело issue: `600a43f22ad5878171cc7dcb4c3a777f7ee977531e9628763373c277e1b95274`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1NzEsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjcxMDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4Miwib3V0cHV0X3Rva2VucyI6MzgyNzEsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTM2NjgzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDE3NDI1MCwiY29zdFVzZEVzdGltYXRlIjoxLjc2NDQ1Nn1dLCJ0dXJucyI6NDcsImR1cmF0aW9uTXMiOjQ4NzA5MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuNzY5MTI3MDAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4653 output_tokens=38291 cache_creation_input_tokens=136683 cache_read_input_tokens=4174250 num_turns=47 -->
