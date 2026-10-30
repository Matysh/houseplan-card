# CODE-REVIEW — issue #1116, заход r1

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 1 → в задаче

Материал: `57b9a5ea0f84914fbb37394450c53a5bbd629aa9` (commits `660f2b170` «fix: bound
continuation discovery and retain terminal read diagnostics» + `57b9a5ea0` «test: bind
the complete safe discovery diagnostic in CLI evidence», ветка `issue/1116-continuation-read`).
Трек: `show`. Этап: `code`. Маршрут вердикта: `route: fix` (задача проходит все
критерии §5: сложность/риск низкие, одна поверхность — два bodyless GET внутри
`workflow-continuation.mjs`, без миграции конфига, без нового UX-контракта,
без влияния на производительность/touch, ожидаемое поведение зафиксировано в
`docs/DEVELOPMENT.md`/`docs/analysis/1116-continuation-discovery.md`, добавленных
этим же материалом).

## Скоуп

Issue #1116 — диагностическая инфраструктурная задача (B/C-only, без
продуктового кода): во время штатного resume-прогона после Validate #1114
job «Exact pending candidate completion» падал с `unexpected end of JSON
input` до создания каталога диагностики, из-за чего повторно не загружался и
`continuation-result` artifact. Причина: два начальных read-only GET
(`actions/runs/{id}`, `actions/artifacts?per_page=100`) выполнялись через `gh
api` вне try/catch конкретного continuation-артефакта, и ошибка прерывала
скрипт до `writeSummary`.

Контракт задачи (три AC из комментария автора 6480557897, зафиксированного в
`REVIEW_CONTEXT`):
- AC1 — только два bodyless metadata GET; известный socket-сбой может
  восстановиться в одной общей retry-границе (≤3 попытки на GET, 100/400 мс,
  ≤6 запросов всего) под одним 30-секундным дедлайном; тело ограничено
  прежними 8 MiB.
- AC2 — HTTP 401/403/429/500/502, malformed JSON, invalid UTF-8/shape,
  oversize и cancellation остаются terminal; terminal discovery сохраняет
  `summary.json` с `unverified`/stage/endpoint/allowlisted reason до любых
  gh/git/claim/dispatch команд; сырое тело/заголовки/токен не логируются.
- AC3 — существующие sealed-artifact/producer-child/CAS/claim/дельта-гарантии
  (#856/#882/#921) не меняются.

Обслуживаемая строка SCOPE: инфраструктура конвейера ревью (PROCESS §1/§9),
не продуктовый Core user job — задача корректно не ссылается на `docs/SCOPE.md`.

Изменённые файлы по диффу (`read:diff`): `.github/workflows/validate-product.yml`,
`.github/workflows/validate-tooling.yml`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/analysis/1116-continuation-discovery.md` (новый), `docs/release-ledger/v1.82.0/1116.json`
(новый), `scripts/ci-profile-paths.json`, `scripts/ci-registry-inventory.json`,
`scripts/continuation-discovery.mjs` (новый), `scripts/workflow-continuation.mjs`,
`test/continuation-discovery.test.mjs` (новый), `test/proof-loop-856.test.mjs` —
всё совпадает с `changedFiles` из `REVIEW_CONTEXT`. Диффом дополнительно
задеты **не объявленные** в `changedFiles` `docs/reviews/INDEX.md` и удаление
`docs/reviews/SPEC-REVIEW-1120-r1.md` — см. находку M1.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` целиком (тело issue, три комментария
автора, handoff, `ciEvidence`), затем через `run_check`:
- `read:diff` — полный base→candidate дифф, прочитан целиком построчно, не
  только объявленные hunks.
- `read:log` — подтверждён двухкоммитный диапазон (`660f2b170`, `57b9a5ea0`),
  совпадает с материалом.
- `read:base:docs/reviews/INDEX.md` — снята база для находки M1 (см. ниже).

Полностью прочитаны (не только диффовые hunks) `scripts/continuation-discovery.mjs`
(новый модуль целиком), `scripts/workflow-continuation.mjs` (вызывающий код:
`continueWorkflows`, `writeSummary`, main-catch), `scripts/read-only-fetch.mjs`
(существующая #921-политика ретраев, на которую опирается новый модуль),
`test/continuation-discovery.test.mjs` (все 7 кейсов) и изменённый кусок
`test/proof-loop-856.test.mjs` (новая `fetchFixture`-обвязка и её встраивание
через `NODE_OPTIONS=--import=`). Проверено, что `.github/workflows/_process-resume.yml`
(не изменён этим диффом, но вызывает `workflow-continuation.mjs`) загружает
`GH_TOKEN` из `secrets.HP_PROCESS_TOKEN` в job env и грузит
`continuation-result` артефакт с `if: always()` + `if-no-files-found: error`
— это объясняет механизм исходного бага (пустой каталог → отказ upload) и
подтверждает, что фикс (`writeSummary` до `throw`) закрывает именно его.

Исполняемые гейты: переиспользован referenced validate-gate зелёный прогон на
точном материале SHA (https://github.com/Matysh/houseplan-card/actions/runs/40775892115,
«review-light proof is complete») — он покрывает `build:*`/`unit:test/*`/tooling
профиль на этом SHA, включая `test/continuation-discovery.test.mjs` (7/7 по
хендоффу), `test/proof-loop-856.test.mjs`, `test/release-read-retry.test.mjs`,
`test/merge-continuation-882.test.mjs` (30/30) и `test/ci-registry-inputs.test.mjs`
(инвентаризация CI). Дополнительных прогонов через `run_check` не делал: диффу
не нужны `build:build`/`build:typecheck`/`build:bundle:sync`/`smoke:*` (нет
фронтенд/бандл/продуктовых изменений — только скрипты tooling, workflow-фильтры
и документация), а для изменённых unit-файлов нет конкретного невоспроизведённого
риска сверх уже покрытого referenced proof. Находка M1 обнаружена чтением диффа
и сверкой `read:base`, а не исполнением — для неё нет подходящего oracle
(удаление файла не ломает ни один существующий тест, `docs/reviews/INDEX.md`
генерируется из текущего набора файлов и самосогласован после удаления).

## Независимый разбор кода (до сверки с хендоффом)

`continuation-discovery.mjs` выделяет ровно два чтения:
`event-run` (`repos/{repo}/actions/runs/{id}`, опционально) и `artifact-list`
(`repos/{repo}/actions/artifacts?per_page=100`, всегда). `endpointPattern`
жёстко ограничивает `read()` этими двумя формами — попытка передать любой
другой endpoint (включая абсолютный URL) отклоняется `invalid-endpoint` ещё до
сети. `boundedJson` сначала проверяет `response.ok`: при не-2xx тело
отменяется (`cancel()`) и бросается `http-{status}` **без парсинга тела** —
это и есть точечный фикс первопричины (`gh` ранее пытался декодировать
пустое/битое error-тело как JSON и ронял процесс с нижним регистром Go-ошибки
до создания каталога диагностики). Чтение тела идёт потоково с накоплением
`size`, останов на `response-too-large` при превышении `DISCOVERY_BODY_BYTES`
(8 MiB — то же значение, что и `maxBuffer` у существующих `gh`/`execFileSync`
вызовов в этом же файле и в `release-prepare.mjs`/`frontend-proof.mjs`, не
новый произвольный лимит). UTF-8 и JSON-парсинг обёрнуты в отдельные
`try/catch` на `invalid-utf8`/`malformed-json`.

Ретраи делегированы существующему `retryingReadFetch` (#921,
`read-only-fetch.mjs`, не изменён). Весь юнит чтения
(`fetch` + `boundedJson`) передаётся туда одной функцией — поэтому ретраится
**вся операция целиком, включая разбор тела**, как и требует AC1 («known
socket failures recover in one retry boundary that includes the body»):
`transientSocketError` проверяет только `code` из множества
`{EPIPE, ECONNRESET, UND_ERR_SOCKET}` и явно исключает `AbortError`/`TimeoutError`;
`rejected(...)`-ошибки (HTTP/JSON/UTF-8/size) не содержат `code` из этого
множества и ни разу не ретраятся — прослежено по коду и подтверждено тестами
«HTTP errors stay terminal…» и «malformed JSON… never become an empty
successful list» (каждый кейс проверяет `calls === 1`). Счётчик попыток в
`retryingReadFetch`: `attempt 0..delays.length` = до 3 попыток, паузы
`[100, 400]` — ровно AC1. Общий дедлайн — один `AbortSignal.timeout(30_000)`,
созданный один раз в `discoveryJsonRead()` и используемый для обоих GET через
замыкание `read` — то есть лимит действительно **общий** на обе операции, не
по 30 с на каждую. Максимум запросов: 3 попытки × 2 независимых endpoint = ≤6,
что совпадает с заявленным.

`continuationDiscovery()` вызывает `step('event-run', …)` только если передан
`eventId`, затем **всегда** `step('artifact-list', …)` — при падении
event-run второй GET не выполняется (честный fail-fast, не «успешный noop»).
Каждая ошибка step() превращается в новую `Error` с safe-листовыми
`discoveryStage`/`discoveryEndpoint`/`discoveryReason` (через `safeReason()` —
закрытый enum регексом), **не сохраняя** исходный текст исключения/тело/заголовки
— проверено чтением и тестом «known socket failures…», который явно утверждает
`assert.doesNotMatch(error.message, /fixture secret/)`.

В `workflow-continuation.mjs` до правки два `api()`-вызова (через `gh api`,
raw CLI) стояли **до** per-continuation `try/catch`, то есть их ошибка
пробрасывалась в main() catch, где `out`-каталог никогда не создавался —
ровно механизм из описания бага (artifact upload падал повторно, т.к.
`${{ runner.temp }}/continuation-result` не существовал). Фикс оборачивает
новый `continuationDiscovery()` в свой `try/catch`, пишет `writeSummary(out,
[discoveryFailure(error)])` **до** `throw` — значит каталог и `summary.json`
гарантированно существуют до возврата из `continueWorkflows`, до любого
`gh`/`git`/claim/dispatch вызова (структура функции это физически
гарантирует — discovery стоит до цикла `for (const artifact of candidates)`,
где эти команды живут). Подтверждено исполняемым тестом «actual CLI fails
closed…», который монки-патчит `cp.execFileSync` на запись маркера и бросание
исключения, затем проверяет `existsSync(marker) === false` — то есть
отрицательный свидетель того, что discovery-отказ физически не доходит до
`gh`/`git`.

Прослежено, что артефакт-лист теперь валидируется по форме
(`Array.isArray(value.artifacts) && value.artifacts.every(row => …
typeof row.name === 'string' && typeof row.expired === 'boolean')`) — до
правки было `api(...).artifacts || []`, то есть **любая** не-`artifacts`-форма
(включая `null`/отсутствие поля) молча превращалась в пустой список
(«успешный noop» без полномочий на самом деле не быть успешным). Это реальное
устранение класса дефекта AC2 («malformed list не становится успешным empty
list»), а не косметика.

`resumeMergeContinuation`, `resumeDomainContinuation`,
`authenticatedMergeCompanion`, `mergeContinuationDecision`,
`mergeReviewedCandidate`, claim/epoch/CAS-проверки — построчно не изменены
этим диффом; единственная правка в их файле — рефакторинг `writeSummary` в
функцию верхнего уровня (было: инлайновый `await import('node:fs')` в конце
функции) и добавление параметра `discoveryRead` для тестовой инъекции.
AC3 подтверждён и чтением (diff review — ни одна из перечисленных функций не
тронута), и тем, что `test/proof-loop-856.test.mjs`/`test/merge-continuation-882.test.mjs`
остались с прежними assert'ами, только `proof-loop-856.test.mjs` получил
новую `fetchFixture`, подключаемую через `NODE_OPTIONS=--import=` **только** к
тому одному тесту, который реально исполняет `.github/workflows/_process-resume.yml`
через `runStep` (остальные тесты файла вызывают функции напрямую и фикстуры
fetch не касаются — проверено чтением всего файла, а не только диффа).

## Находки

### M1 (Medium, в скоупе материала) — диф #1116 удаляет чужой принятый
review-артефакт без объяснения

`read:diff` показывает `deleted file mode 100644` для
`docs/reviews/SPEC-REVIEW-1120-r1.md` и правку `docs/reviews/INDEX.md`
(«Документов: 220, issue: 106» → «219, issue: 105», строка `#1120` убрана из
таблицы). `read:base:docs/reviews/INDEX.md` подтверждает: в базе материала
(родителе коммита `660f2b170`) файл и строка присутствовали — то есть удаление
сделано именно двумя коммитами этой ветки (`660f2b170`/`57b9a5ea0`), не
сторонним состоянием `dev`. Файла нет и в `docs/reviews/archive/**` (архивный
механизм #682 — `scripts/reviews-archive.mjs` — перемещает документы, не
удаляет: `archivePlan` формирует только `moves`/`kept`, в репозитории сейчас
нет каталога `docs/reviews/archive/` вовсе) — то есть это не легитимный
archive-move, а настоящая потеря зелёного `SPEC-REVIEW-1120-r1.md` (вердикт
был 🟢 зелёный, 0/0, с валидным publication-receipt).

Ни один из этих двух файлов не входит в `changedFiles` `REVIEW_CONTEXT`, не
упомянут в разделах «Файлы»/«НЕ сделано»/«Риски» хендоффа и не имеет
отношения к continuation-discovery (AC1–AC3). Правдоподобное объяснение —
случайная потеря при одном из двух описанных автором ребейзов («оба ребейза
были обязательны из-за реальных docs/STATUS/inventory conflicts с принятыми
#1117/#1115»), но хендофф формулирует это как «оба принятых текста и
вычисленный совмещённый учёт сохранены», что по факту неверно для #1120.

Последствие: теряется аудиторская запись о принятом ревью ТЗ #1120 (зелёный
вердикт, publication-receipt, usage-учёт), а счётчики `docs/reviews/INDEX.md`
занижаются на 1/1 без основания — ни один существующий тест (`reviews-index.test.mjs`,
`candidate-reviews-index.test.mjs`) этого не ловит, так как `INDEX.md`
самосогласован с фактическим (уже урезанным) набором файлов. Это дефект
корректности инфраструктуры конвейера (трек show прямо относит инфраструктурные
дефекты к этой категории), а не вкусовое замечание.

**Чем краснеет / требуемое исправление:** восстановить
`docs/reviews/SPEC-REVIEW-1120-r1.md` (или явно обосновать его намеренное
удаление с указанием причины и задачи #1120) и пересчитать
`docs/reviews/INDEX.md` до фактического состояния — обычный `git diff` после
восстановления покажет 0 расхождений с базой по этим двум файлам.

Находка в скоупе материала (файл буквально в диффе этого issue) — не
выносится как побочная вне-скоуп находка; правится в текущей задаче #1116
(§3 п.8, трек show).

## Что проверено и корректно

| AC | Чем доказан | Чем краснеет / отказ |
|---|---|---|
| AC1 — bounded read-only recovery (≤3 попытки/GET, 100/400 мс, ≤6 запросов, общий дедлайн 30 с, тело ≤8 MiB) | прочитан код `continuation-discovery.mjs` + `read-only-fetch.mjs` независимо от хендоффа; `test/continuation-discovery.test.mjs` («known socket failures…», «response cap is exact…») | известный socket-сбой ретраится максимум трижды (тест проверяет `calls===3`, `pauses=[100,400]`); превышение `DISCOVERY_BODY_BYTES` на 1 байт — `response-too-large`, без ретрая (`calls===1`); cancellation/deadline — `read-cancelled`, без ретрая; endpoint вне двух форм — `invalid-endpoint` до сети |
| AC2 — terminal failures actionable, без authority, без утечки payload/токена | прочитан `boundedJson`/`discoveryFailure`; `test/continuation-discovery.test.mjs` («HTTP errors stay terminal…», «actual CLI fails closed…») | HTTP 401/403/429/500/502 — `http-{status}` без парсинга тела (проверено построчно: `!response.ok` ветка выполняется до `getReader()`); malformed/invalid-shape/UTF-8/oversize — `invalid-response`/`malformed-json`/`invalid-utf8`/`response-too-large`, артефакт `unverified`/`authority:false` до любых `gh`/`git` команд (CLI-тест монки-патчит `execFileSync` и проверяет отсутствие маркера) |
| AC3 — старые sealed-artifact/producer-child/CAS/claim границы не меняются | diff review: `resumeMergeContinuation`/`resumeDomainContinuation`/`authenticatedMergeCompanion`/`mergeReviewedCandidate` не изменены построчно; `test/proof-loop-856.test.mjs`, `test/merge-continuation-882.test.mjs` с прежними assert'ами | не исполнялось повторно в этой сессии — переиспользован referenced validate-gate (40775892115) на точном материале SHA; проверено чтением, не исполнением, в части самого инварианта «код не тронут» |

Дополнительно проверено и корректно:
- `.github/workflows/validate-product.yml`/`validate-tooling.yml` — новый
  `test/continuation-discovery.test.mjs` добавлен в алфавитно верную позицию
  (между `config-lifecycle` и `converter-output`) как `!исключение` в
  product-негативном списке и как позитивный путь в tooling-списке —
  соответствует декларации «B/C-only, без продуктового кода».
- `scripts/ci-profile-paths.json`/`scripts/ci-registry-inventory.json` —
  вычисляемые инвентари, изменения синхронны с добавлением файла/ledger-записи;
  переиспользован прогон `ci-registry-inputs.test.mjs` из referenced proof.
- `docs/release-ledger/v1.82.0/1116.json` — категория `infra` относительно
  `v1.82.0`, без `milestone`-поля — соответствует правилу «инфраструктура и
  внутри-бетные исправления не входят в пользовательский milestone релиза».
- `docs/STATUS.md` — счётчик «Node unit» `5834→5841` (+7) совпадает с
  фактическим числом новых `test(...)` блоков в `test/continuation-discovery.test.mjs`
  (пересчитано вручную — ровно 7); число встречается в репозитории один раз
  (`grep` по `*.md` не нашёл дублей) — один источник, нет рассинхрона (§8).
- Нет продуктового кода, пользовательских настроек, i18n, миграции — не
  нужны ни golden, ни frontend-бюджет, ни E2E; это подтверждается диффом
  (только `scripts/*.mjs`, `test/*.mjs`, workflow-фильтры, docs).

## Чего не проверял

- Полные сообщения коммитов `660f2b170`/`57b9a5ea0` (трейлеры `Issue:`/`User-Visible:`)
  — доступный `read:log` отдаёт только `--oneline`-форму (подтверждено по
  байтовому объёму вывода), другого объявленного check_id для полного
  `git log --format=fuller` в манифесте нет, прямого `git`-доступа у ревью нет.
  Косвенно: `docs/release-ledger/v1.82.0/1116.json` классифицирует задачу как
  `infra` без `milestone`, changelog-файлы в диффе не тронуты — согласуется с
  ожидаемым `User-Visible: no`, но сам трейлер не читался напрямую.
- Повторное исполнение `unit:test/continuation-discovery.test.mjs`,
  `test/proof-loop-856.test.mjs`, `test/release-read-retry.test.mjs`,
  `test/merge-continuation-882.test.mjs`, `test/ci-registry-inputs.test.mjs` —
  не запускал заново: входы/окружение/oracle не менялись относительно
  referenced зелёного validate-gate на точном материале SHA
  (https://github.com/Matysh/houseplan-card/actions/runs/40775892115).
- `build:build`/`build:typecheck`/`build:bundle:sync`/любые `smoke:*` — не
  запускал: в диффе нет фронтенд/бандл/продуктовых изменений, которые бы их
  затронули; соответствует заявлению хендоффа «E2E impact — не надо».
- Фактический исторический endpoint/HTTP-статус сбойного job 122872614664 —
  не восстанавливается в принципе (лог не содержит этих данных); это признано
  и автором, и этим ревью одинаково — не предмет проверки.
- Содержимое `docs/reviews/SPEC-REVIEW-1120-r1.md` по существу (корректность
  того старого ревью) не пересматривалось — проверялся только факт его
  исчезновения в этом материале (находка M1).

## Гейты — что прогнано, что нет и почему

- `read:diff`, `read:log`, `read:base:docs/reviews/INDEX.md` — выполнены через
  `run_check`, см. «Как проверялось».
- Переиспользован зелёный validate-gate на точном материале SHA
  `57b9a5ea0f84914fbb37394450c53a5bbd629aa9`:
  https://github.com/Matysh/houseplan-card/actions/runs/40775892115
  («review-light proof is complete») — покрывает build/typecheck/bundle/tooling
  unit-набор, включая новый `test/continuation-discovery.test.mjs` (7/7 по
  хендоффу) и затронутые существующие `proof-loop-856`/`release-read-retry`/
  `merge-continuation-882`/`ci-registry-inputs` (30/30 + отдельно PASS).
  Новых входов/окружения/oracle относительно этого прогона не появилось —
  дополнительный повтор не даёт нового сигнала.
- `build:*`/`smoke:*` из манифеста — не прогонялись: диффу не нужны (нет
  фронтенд/бандл/продуктовых изменений).
- Находка M1 обнаружена и подтверждена исключительно чтением (`read:diff` +
  `read:base`), без исполнения — для неё нет soразмерного исполнимого oracle
  (удаление файла не ломает автогенерацию `INDEX.md`, она самосогласована).

## Побочные находки вне скоупа

Побочных находок Medium вне скоупа этой задачи не обнаружено. Находка M1
литерально входит в дифф материала #1116 (удалённый файл и правка `INDEX.md`
— часть коммитов `660f2b170`/`57b9a5ea0`), поэтому заведена как находка **в
скоупе**, а не как outside-finding для trusted publisher (`mode: issues` по
`REVIEW_FINDINGS_POLICY` в этом раунде не задействован — `outside_findings`
пуст).

## Материал раунда

- Ветка: `issue/1116-continuation-read`, коммиты `660f2b170` + `57b9a5ea0`.
- Материал: `57b9a5ea0f84914fbb37394450c53a5bbd629aa9`, дерево
  `8442e78caebe1a0bb3afdd5ec79fb97b4801d751`.
- Тело issue: `e7415ce37993ba0b191b58c4eed491a8fdeb59c6996302a11c84c489850d5085`.
- Вердикт: жёлтый · High 0 · Medium 1 (в скоупе) · маршрут `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImIyZjBmZWY5MzBhNDg0Mzc2Mzg4ODU4ZGI0YWQyMGY3MGQ4MDg3OTgxNjVlN2Y5NjMyMmZiOWVmNzU0MDBiZjciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3NDJkMzQwOTU0MDgyMTcyNWE2ZDY1MjlhOGMxNzNiMDZmNjY4NzE1YzhjMmZhOGZjMGZlZTU5MGUxNGE2YTM4IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE2LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1N2I5YTVlYTBmODQ5MTRmYmIzNzM5NDQ1MGM1M2E1YmJkNjI5YWE5IiwidHJlZSI6Ijg0NDJlNzhjYWViZTFhMGJiM2FmZGQ1ZWM3OWZiOTdiNDgwMWQ3NTEiLCJib2R5RGlnZXN0IjoiZTc0MTVjZTM3OTkzYmEwYjE5MWI1OGM0ZWVkNDkxYThmZGViNTljNjk5NjMwMmExMWM4NGM0ODk4NTBkNTA4NSIsInByb2R1Y2VyUnVuIjoiNDA3NzY5MTUyNDEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImM4ZTg0MDgyOWZiN2RjOTNlNTcyNjUyY2ZkNjA5MTQxOTgxYWY1NjNmMTk1MWMwY2ZkMmQ2YTQ4ZTVlYjI0MmYiLCJ2ZXJkaWN0RGlnZXN0IjoiZWZhNDI1Y2U3YjQ3MGI4NTQ2MDE0MzZiNDM3YzA2ZDcxYTc0YjZhNDdlZWZhZTQ2NTJlMzU2MzgxMTM3OWE2OSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIwYzAwMjM1OTUwNzMxNGM1ZDQwNDg4ZmYyYmFkODdmMGM0ZjYyMWIzMzJhMmYzMWRlN2ZkZGI0MTM2NGNkNzMzIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgyMDM3MjA2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE2I2lzc3VlY29tbWVudC02NDgyMDM3MjA2IiwiYm9keURpZ2VzdCI6IjI4MmIzMTY4ZTE1ZjU3MjE1ZThiZTRhNTM3MWJmOTAzZGQxZDQ3NGJlZWRjMGJiMDc1YmVmMjE0OTRiZGE1MzcifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1116-continuation-read`, коммит `57b9a5ea0f84` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8442e78caebe1a0bb3afdd5ec79fb97b4801d751`
  ```
  git log --all --format='%H %T' | grep 8442e78caebe
  ```
- Тело issue: `e7415ce37993ba0b191b58c4eed491a8fdeb59c6996302a11c84c489850d5085`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjAsIm91dHB1dF90b2tlbnMiOjQyMjUxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3NDQyNSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM1MzkxMzEsImNvc3RVc2RFc3RpbWF0ZSI6MS44MjgxNTYxOTk5OTk5OTk4fV0sInR1cm5zIjo0MCwiZHVyYXRpb25NcyI6NTI4MjMxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS44MjgxNTYxOTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=60 output_tokens=42251 cache_creation_input_tokens=174425 cache_read_input_tokens=3539131 num_turns=40 -->
