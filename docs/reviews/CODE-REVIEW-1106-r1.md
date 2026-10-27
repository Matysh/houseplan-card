# CODE-REVIEW #1106 — заход r1

## Скоуп

Issue #1106, этап `code`, трек `show`. Материал: `a3f8918e325663a49ad17c5fa7806b72a90c0c75` (единственный коммит
`fix: separate review publication history and response bounds` поверх базы `455535be9d`).

Изменённые файлы: `scripts/review-publication.mjs`, `test/review-publication.test.mjs`,
`docs/STATUS.md`, `docs/release-ledger/v1.82.0/1106.json`, `scripts/ci-registry-inventory.json` (generated).
Продуктовых файлов (src/, bundle, config, i18n) в диффе нет — инфраструктурная правка пайплайна ревью.

Задача задана владельцем как инфраструктурный дефект: `realOps.pages` в `scripts/review-publication.mjs`
использовал единый предел 8 MiB и для одного ответа `gh api`, и для суммы всей постраничной истории issues,
из-за чего публикация ревью #1000 остановилась на `API pagination exceeds its aggregate bound`.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT`, тело issue #1106 и все три комментария (включая назначение
trusted `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES=[1106]` по PROCESS §10.4 и хендофф). Прочитан диапазон
коммитов (`read:log`) и полный дифф (`read:diff`), затем — изменённый `scripts/review-publication.mjs`
и `test/review-publication.test.mjs` целиком, прослежены вызывающие пути `pages()` → `api()` →
`execFileSync`/injected `run`, инварианты (три независимых предела: на ответ, на сумму, на число страниц)
и точки отказа.

Независимо от хендоффа выполнены адресные проверки через `mcp__houseplan_review__run_check` (без shell,
без изменения предмета ревью):

- `read:diff`, `read:log` — подтверждают единственный коммит и точное содержимое изменений.
- `unit:test/review-publication.test.mjs` — **17/17 PASS** (включая все четыре новых теста `#1106`),
  воспроизведено независимо от заявления автора.
- `unit:test/ci-registry-inputs.test.mjs` — PASS (exit 0), подтверждает согласованность сгенерированного
  `scripts/ci-registry-inventory.json` с новой записью ledger.
- `static:ci-registry-inventory` — PASS (exit 0), статическая проверка самого generated-файла.

Существующий зелёный `validate-gate` (run 40582176144, материал тот же SHA) используется как уже
пригодное доказательство для остального объёма (build/typecheck/bundle/gate:small), без повторного
прогона — материал, вход и oracle не менялись.

## Независимый разбор кода

`API_RESPONSE_BYTES = 8 MiB` остаётся лимитом ровно одного `execFileSync('gh', …, { maxBuffer })` —
поведение не изменилось относительно базовой версии (значение то же, только вынесено в константу).
Новый `API_HISTORY_BYTES = 64 MiB` суммирует `Buffer.byteLength(JSON.stringify(rows))` по каждой странице
**до** `out.push(...rows)`; при превышении `fail()` бросает исключение раньше, чем страница попадёт в
накопленный результат — частичная история технически не может быть возвращена (разобрано по коду и
подтверждено тестом «refuses the next byte without partial history»). Условие `bytes > API_HISTORY_BYTES`
(не `>=`) означает, что ровно 64 MiB — валидная граница, а дальше один байт — отказ; это прямо соответствует
формулировке ТЗ («aggregate больше 64 MiB … завершаются отказом») и перекрёстно проверено тестом на
`extra ∈ {0,1}`.

Цикл страниц (`for (page = 1; page <= 100; page++)`) и финальный `fail('API pagination bound exceeded')`
вне цикла не изменились — прежний максимум 100 страниц сохранён.

`realOps(repo, run = execFileSync)` стал экспортируемым и получил необязательный второй параметр —
единственная точка внедрения транспорта для unit-тестов; в production-коде (`isMainModule` ветка) вызовы
`realOps(repo)` используют дефолт `execFileSync`, нового CLI-флага или override нет. Функции `api`, `pages`,
`actor/comments/issues/createComment/createIssue` не изменили сигнатур и логики относительно прежней
реализации, кроме вынесенных констант — авторизация publisher, дедупликация (`requireSingle`,
`records`), проверка sealed-результата (`assertPlan`) и отказ при неизвестном исходе записи не затронуты,
что подтверждено построчным сравнением с `read:base:scripts/review-publication.mjs` через дифф.

Новые тесты `#1106` не подменяют `pages()` целиком, а внедряют только CLI-вызов (`run`), так что реальная
постраничная логика и оба предела исполняются по-настоящему: `sizedPage()` формирует страницы точного
байтового размера, тест на 64 MiB реально проходит девять страниц по 7 MiB и проверяет точную границу
последней страницы; тест на malformed/page-count исполняет реальный цикл до отказа; тест на CLI-буфер
запускает настоящий дочерний процесс (`execFileSync(process.execPath, …)"`), выводящий 9 MiB, чтобы
проверить, что ответ по-прежнему ограничен 8 MiB. Это обычные negative-input проверки на неизменённой
реализации — мутанты не требовались и не исполнялись.

`docs/STATUS.md`: добавлен абзац, точно описывающий новые пределы (8 MiB/64 MiB/100 страниц) и сохранённые
гарантии (идентичность, дедупликация, отказ при неизвестной записи); счётчик `Node unit` обновлён
5688→5692, что совпадает с четырьмя добавленными тестами. `docs/release-ledger/v1.82.0/1106.json` —
категория `infra`, формат идентичен прецеденту `1104.json` (та же подсистема — публикация ревью);
обоснование соответствует характеру правки (нет продуктового поведения/payload). `introducedBy` не
требуется — правка не относится к новой бета-функции. `scripts/ci-registry-inventory.json` — две ссылки на
новый ledger-файл добавлены в консистентные позиции (лексикографический порядок между `1104.json` и
`638.json`), подтверждено PASS обоих unit/static-проверок.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (многостраничная история > 8 MiB через injected CLI, включая поздний элемент; один ответ ограничен 8 MiB) | `test/review-publication.test.mjs`: `#1106 real pagination finds the existing publication beyond 8 MiB without duplicate writes` — PASS (независимо перезапущен, `unit:test/review-publication.test.mjs`, 17/17) | Тест читает поздний `m.issues[0]` через 3 реальные страницы (`issuePages: [1,2,3,1,2,3]`) и упал бы, укажи `realOps` старый общий лимит 8 MiB на сумму — история там явно `> 8 MiB` |
| AC2 (aggregate > 64 MiB, неверная форма/JSON, >100 страниц — отказ без партиальной истории) | `#1106 aggregate accepts exactly 64 MiB and refuses the next byte…`, `#1106 malformed page and excessive page count fail closed…` — обе PASS в том же прогоне | Негативная ветвь `extra=1` (64 MiB + 1 байт) проверяет реальный throw `API pagination exceeds its aggregate bound`; malformed-page ветвь — `API pagination shape`/`API operation failed`; 100-страничная ветвь — `API pagination bound exceeded`. Все три — обычные negative-input случаи на неизменённой реализации, исполнены в этом прогоне |
| AC3 (сохранены полный поиск дубликатов, identity, повторный запуск, отказ при неизвестном исходе; targeted tests + `gate:small` зелёные) | Все исходные тесты `#1065 …` (13 шт.) в том же файле не изменены по тексту (сверено диффом) и PASS в независимом прогоне; `gate:small` зелёный заявлен автором и подтверждён контекстным `validate-gate` (run 40582176144, тот же SHA) | Существующие негативные тесты (`foreign or changed publication identity`, `do not rerun`, `missing`, `changed`) — обычные negative-input случаи, все PASS в независимом прогоне `unit:test/review-publication.test.mjs` |

## Что проверено и корректно

- Разделение пределов (8 MiB/ответ, 64 MiB/история, 100 страниц) реализовано корректно и без регрессии
  по старым инвариантам — подтверждено чтением и независимым прогоном тестов.
- `scripts/ci-registry-inventory.json` и `docs/release-ledger/v1.82.0/1106.json` согласованы с остальным
  репозиторием — подтверждено PASS `static:ci-registry-inventory` и `unit:test/ci-registry-inputs.test.mjs`.
- `docs/STATUS.md` точно отражает изменение и не содержит лишних/противоречивых утверждений.
- Нет изменений UX, i18n, persisted config, bundle, golden — подтверждено составом `changedFiles`.
- Маршрут вердикта (§5): сложность/риск низкие, одна поверхность (один модуль пайплайна ревью), нет
  миграции конфига, нет нового UX-контракта, нет влияния на perf/touch-контракт продукта, ожидаемое
  поведение зафиксировано в теле issue и `docs/STATUS.md` → критерии §5 пройдены, `route: fix`.

## Чего не проверял

- Полный текст коммита с трейлерами `Issue:`/`User-Visible:` — доступный фиксированный `read:log`
  отдаёт только `--oneline`; отдельного канала для чтения трейлеров коммита в выданном манифесте нет.
  Косвенно: `changedFiles` не включает ни один из пользовательских changelog-файлов, а сам текст issue
  прямо утверждает отсутствие изменений UX/i18n/продукта — это согласуется с `User-Visible: no`, но
  независимо байт в байт трейлер не прочитан; честно фиксирую эту границу, а не выдаю её за «verified».
- `build:build`/`build:typecheck`/`build:bundle:sync`/полный `gate:small` не перезапускались — в диффе нет
  TS/bundle/product-файлов, и тот же материал уже зелёный на `validate-gate` (run 40582176144); повторный
  общий прогон не является адресной проверкой под конкретный пробел (политика ревью).
- Browser-smoke не запускались — тело issue не называет смоук-сценарий, изменений UI/канваса нет.
- Восстановление публикации #1000 (отдельное действие координатора) — вне скоупа этой задачи, не
  проверялось и не должно проверяться здесь.

## Побочные находки

Маршрут согласно `REVIEW_FINDINGS_POLICY` (`mode: "file"`, trusted snapshot `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES=[1106]`):
побочные находки публикуются отдельным файлом (`docs/reviews/findings/1106-code-r1.md`), новые issues
не заводятся. `outside_findings` в структурированном выводе оставлен пустым.

Побочных находок нет.

## Гейты: что прогнал и что нет

Прогнал (адресно, в этой сессии):
- `read:diff`, `read:log` — PASS.
- `unit:test/review-publication.test.mjs` — PASS, 17/17.
- `unit:test/ci-registry-inputs.test.mjs` — PASS (exit 0).
- `static:ci-registry-inventory` — PASS (exit 0).

Не прогонял (переиспользую пригодное доказательство или вне объёма):
- `build:build`, `build:typecheck`, `build:bundle:sync` — нет TS/bundle-файлов в диффе; тот же материал
  уже зелёный на `validate-gate` (run 40582176144).
- Полный `npm run gate:small` — заявлен PASS автором (434 s, 0 failed) и покрыт тем же `validate-gate`;
  общий gate не используется как запасной сценарий ревью при отсутствии адресного пробела.
- `unit:test/process-gate.test.mjs` — `process-gate.mjs` не входит в дифф, не затронут правкой.
- Browser-smoke (demo/smoke_*.mjs) — не требуются телом issue, UI/канвас не менялись.

## Вердикт

Находок High/Medium в скоупе нет. Маршрут `fix` (критерии §5 пройдены). Вердикт: **зелёный**.

Учёт: заход r1, блокирующих циклов 0/2.

---

Побочные находки: [docs/reviews/findings/1106-code-r1.md](findings/1106-code-r1.md).
<!-- hp:outside-findings-blob 35e22bd2ad433ed2d89b8ccb56638a7316cb9543 -->

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI3NGI2OWJkYmUzZjVlYTU0NmFiZTA1NGUxMTc5ZjZiM2VlYzQwMDJhYTQ1Yjc0ZWFiNWYxN2I5MGE0MmJlMGMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJjYTlkZTExNmJjYTQyNGE1M2Q1YmI0YjI2NGE2YzdjN2E1ZDc3YThiMjQ0NDJiNTQzMzI2YjgwOTI0MzJkNzI3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTA2LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJhM2Y4OTE4ZTMyNTY2M2E0OWFkMTdjNWZhNzgwNmI3MmE5MGMwYzc1IiwidHJlZSI6IjU5ZjFmNDE4ZDRiYWJkY2Q1ZDUyNTkwYzdkMzllZjI2NjhhNjcyYWQiLCJib2R5RGlnZXN0IjoiZjVjZjhjZjljNDEyZjQzODkyYzMxZGM5OTdlZjE0N2NlNDc0YTk4YmU2NmQzZTgzMGU1MGE4MDZlZTExYmMwNSIsInByb2R1Y2VyUnVuIjoiNDA1ODMzMDY3NzgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjQxMThmMTc2OGJmYjI3ODAwNGMyYzAxNGMxYjExNTY3YTliZGY3NWQ3MDg2Y2U4ZjIyYzcwMGQ3ZjBhNThjMTMiLCJ2ZXJkaWN0RGlnZXN0IjoiZDNlZjliZDZhYjY5OGRiYmI2ZjU5NDUxMmFhN2FlNGYzNGQ2NGI4ZjYwMjZiYzJhMzcxMTI1MjFkYzNmMTU0ZSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI2ODk0YTFjMDNlOWVlYmM0YWI2ZjliMzU3OGM3MzU5NDVlY2FhOTUxOWEzZmRiZDU2MDZmZjI5ZmE5NjhhZjY4IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDUzNjYyNDgxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTA2I2lzc3VlY29tbWVudC02NDUzNjYyNDgxIiwiYm9keURpZ2VzdCI6Ijc0ZmVkYmM3ODU0YjNmNGNlN2VhMjMxZWFjYmFhZjFiMDVmMWZlYWZjNzk3ODExNjIwOWI5MzQyNzA5N2ZhODAifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1106-review-publication-bound`, коммит `a3f8918e3256` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `59f1f418d4babdcd5d52590c7d39ef2668a672ad`
  ```
  git log --all --format='%H %T' | grep 59f1f418d4ba
  ```
- Тело issue: `f5cf8cf9c412f43892c31dc997ef147ce474a98be66d3e830e50a806ee11bc05`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40583306778,"run_attempt":1,"digest":"3294b2f096a354eadbc4dba7599268accc31722e613dd735649a8208cfc0e841"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDAsIm91dHB1dF90b2tlbnMiOjIwMTM3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwMjUyNCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE0MTk2MzAsImNvc3RVc2RFc3RpbWF0ZSI6MC44OTU0NzJ9XSwidHVybnMiOjMwLCJkdXJhdGlvbk1zIjoyODgzMTUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjg5NTQ3MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=40 output_tokens=20137 cache_creation_input_tokens=102524 cache_read_input_tokens=1419630 num_turns=30 -->
