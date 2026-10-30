# CODE-REVIEW — issue #1115 · заход r2

**Вердикт: зелёный · заход r2 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-1115-r2.md**

Материал: `bf5c866e447158716067f3655c99669af391643b` (ветка `issue/1115-native-finalization`), трек `show`, этап `code`.

## Скоуп

Issue #1115 не изменилась по существу: попутная гонка наблюдения owned
pipe-holder фикстуры (#1065) в `test/review-native-runner.test.mjs` исправлена
опросом состояния PID в пределах прежнего единого абсолютного дедлайна
2000мс вместо разового чтения `/proc/<pid>/stat`. Это уже было независимо
проверено и принято зелёным в `docs/reviews/CODE-REVIEW-1115-r1.md`
(материал `4cec874a8326`).

Между r1 и r2 **код не правился**: после зелёного r1-вердикта автоматическое
слияние обнаружило конфликт с параллельно принятой #1117 и вернуло задачу в
`S6-in-progress`. Автор сделал **ручной ребейз** ветки на новый `dev`
(`c874bb26`, уже включающий #1117) и опубликовал новый материал
`bf5c866e4`. По PROCESS §2.10 ребейз на новый `dev` — другой код, который
нельзя принимать без повторной проверки; поэтому этот раунд — не
формальность, а независимая проверка именно дельты ребейза.

Диапазон `origin/dev..HEAD` (`git log --oneline`) — ровно 2 коммита:
`a9cd1eec0 test(review): observe owned-child exit within original deadline`
(тот самый контентный коммит из r1) и `bf5c866e4 docs: review document for
#1115` (авто-публикация r1-документа конвейером). Файлы в `read:diff`
совпадают один в один со списком `changedFiles` из `REVIEW_CONTEXT`:
`test/review-native-runner.test.mjs`, `docs/STATUS.md`,
`docs/DEVELOPMENT.md`, `docs/release-ledger/v1.82.0/1115.json`,
`scripts/ci-registry-inventory.json`, `docs/reviews/CODE-REVIEW-1115-r1.md`.

## Как проверялось (независимый разбор дельты ребейза)

1. Прочитаны обязательные источники роли (`docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md`), `REVIEW_CONTEXT` и приложенные страницы issue
   (тело + все 6 комментариев, включая оба take-up/хендоффа и записи о
   конфликте/возврате в S6), `REVIEW_FINDINGS_POLICY`.
2. Полностью прочитан принятый `docs/reviews/CODE-REVIEW-1115-r1.md` —
   независимый разбор логики исправления, fail-closed гарантий, читаемости
   и находок, выполненный в r1.
3. `read:diff` (run_check) — построчно разобран весь дифф
   `origin/dev...bf5c866e4`. Проверено, что:
   - хунки `test/review-native-runner.test.mjs` **текстуально идентичны**
     тем, что были разобраны в r1 (новая функция `assertOwnedProcessStopped`,
     два новых юнит-теста, правка сценария строки ~233);
   - `docs/DEVELOPMENT.md` получает тот же абзац «Review execution boundary
     (#1115)», что и в r1 — проверено посимвольно через `read:diff` и
     независимым чтением текущего файла (`docs/DEVELOPMENT.md:6247-6255`);
   - `docs/STATUS.md` получает тот же абзац про #1115, но из-за ребейза на
     новый `dev` производные строки блока `status-snapshot:begin/end`
     пересчитаны: `Generated` 2026-10-28→2026-10-29, `Node unit` 5832→5834 —
     тот же прирост на 2 новых теста, что был в r1, относительно нового
     базового значения после слияния #1117;
   - `docs/release-ledger/v1.82.0/1115.json` — файл с тем же содержимым
     (`category: infra`, без `introducedBy`), что и в r1;
   - `scripts/ci-registry-inventory.json` — механическая вставка строки
     `docs/release-ledger/v1.82.0/1115.json` в двух списках, по алфавиту
     рядом с уже присутствующим `.../1114.json` и `.../1117.json` (1117 уже
     в базе — подтверждает, что ребейз действительно встал поверх дерева,
     включающего #1117);
   - `docs/reviews/CODE-REVIEW-1115-r1.md` впервые попадает в диапазон
     `origin/dev..HEAD` — это не новая правка автора, а публикация прежнего
     зелёного документа конвейером (коммит `bf5c866e4`), сохранённая при
     ребейзе без изменений.
   `scripts/review-native-runner.mjs` (производственный runner, сигналы,
   таймауты, права) в диффе отсутствует — подтверждает слова автора и r1,
   что продуктовый путь не менялся.
4. Независимым чтением (не по диффу, а по текущему состоянию файлов)
   проверено отсутствие артефактов неудачного ручного мерджа: в
   `docs/STATUS.md` и `docs/DEVELOPMENT.md` нет маркеров конфликта
   (`<<<<<<<`/`=======`/`>>>>>>>`), строка `#1115` встречается ровно один
   раз в каждом файле (не задублирована), запись `#1117` сохранена рядом.
5. Исполнен `unit:test/review-native-runner.test.mjs` (run_check) заново —
   адресная причина: материал и окружение (дерево после ребейза) другие,
   чем при прогоне в r1, несмотря на идентичность содержимого файла; история
   файла — три предыдущих RED-инцидента (#1099, #1100, сама задача), что
   является валидным поводом для повторного адресного прогона по общей
   политике ревью. Результат: `17/17 PASS`, `0 failed`, включая тест
   `#1065 exited native leader cannot leave an owned pipe-holder beyond
   bounded finalization` — не пропущен (`linux`), 169.48ms, реальный
   pipe-holder сценарий исполнялся, а не был статически прочитан.
6. `read:log` (run_check) подтвердил точный диапазон из двух коммитов,
   без посторонних коммитов продукта в ветке.

## Что проверено и корректно

- **Контент идентичен r1.** Логика исправления (единый абсолютный дедлайн,
  отказ для `R/S/D/T`, опрос вместо разового чтения) не изменилась ни на
  символ — весь анализ r1 («Логика исправления», «Fail-closed сохранён»,
  «Производственный путь не ослаблен», «Главный регрессионный сценарий
  фактически исполнялся») остаётся в силе и подтверждён заново свежим
  прогоном в этом раунде, а не просто унаследован без проверки.
- **Ребейз чистый.** Нет маркеров конфликта, нет дублирования записей
  `#1115`/`#1117` в `STATUS.md`/`DEVELOPMENT.md`; `ci-registry-inventory.json`
  согласован (алфавитный порядок, обе точки вставки).
- **Один источник числа (§8), пересчитан корректно.** `Node unit` 5834 —
  прирост на 2 новых теста (как и в r1) относительно нового базового
  значения дерева после слияния #1117; `Generated` дата сдвинута на дату
  ребейза — оба поля из сгенерированного блока `status-snapshot:begin/end`,
  источник один (`npm run inventory`), дублирования не найдено.
- **Трейлеры/changelog.** `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`
  по-прежнему отсутствуют в диффе — согласуется с `User-Visible: no`
  (инфраструктурная правка теста ревью). Вывод r1 не меняется.
- **CI-доказательство переиспользовано обоснованно.** `ciEvidence` указывает
  на зелёный validate-gate именно для `bf5c866e4`
  (`actions/runs/40771181912`, «review-light proof is complete»). Это
  доказательство для текущего SHA, не для устаревшего — повторный gate:small
  не требуется; адресный пробел (идентичность переживших ребейз файлов и
  исполняемость теста) закрыт целевыми проверками выше, а не общими
  build/test.
- **Маршрут (§5) не меняется.** Правка не затрагивает `src/**`, не вводит
  миграций/конфигов/UX, риск/сложность не выросли относительно r1 —
  `route: fix` остаётся в силе.

## Находки

Новых находок в этом раунде нет. High/Medium в скоупе — не найдено.
Единственная находка r1 (Low, текст сообщения assert при истёкшем дедлайне с
уже терминальным состоянием) не затронута диффом ребейза (строка кода не
менялась) — остаётся снятой, цикл не открывает.

Побочных находок вне скоупа нет. `outside_findings` пуст — в этом раунде
побочных Medium-находок не возникло, публиковать через typed outside_findings
нечего.

## Гейты — что прогнал и какие нет и почему

| Гейт | Статус | Источник |
|---|---|---|
| `unit:test/review-native-runner.test.mjs` (`node --test`, 17/17 PASS, реальный Linux pipe-holder сценарий не skip) | Прогнан адресно заново в среде ревью (новая причина: материал/дерево после ребейза другие) | `run_check`, receipt `f5652ca2…`, 985.85ms |
| `read:diff` / `read:log` | Прогнан | подтверждение точного содержимого диффа и двухкоммитного диапазона |
| Чтение текущего состояния `docs/STATUS.md`, `docs/DEVELOPMENT.md`, `scripts/ci-registry-inventory.json`, `docs/release-ledger/v1.82.0/1115.json` (поиск маркеров конфликта/дублирования) | Прогнано (Read/Grep) | независимая проверка чистоты ручного ребейза |
| `gate:small` / полный validate-gate на `bf5c866e4` | Переиспользован, не повторялся | `actions/runs/40771181912`, «review-light proof is complete» — тот же материал, вход/окружение CI не менялись |
| `tsc`/`build`/`bundle`/полные browser-smokes | Не прогонял | дифф не затрагивает `src/**` или сборку; инфраструктурная задача, полные наборы — предрелизный гейт (§8), не гейт ревью |
| `pytest tests_backend`, инварианты модели, Golden | Не прогонял | дифф не касается Python/геометрии/рендера |
| Полный текст коммитов с трейлерами `Issue:`/`User-Visible:` | Не проверял напрямую (как и в r1) | инструментарий ревью не даёт доступа к телу коммита; отсутствие правок changelog в диффе согласуется с `User-Visible: no` |

## Чего не проверял

- Полный текст коммитов (трейлеры) — та же граница инструментария, что и в
  r1.
- Причину исходного флака #1065/#1115 статистически — задача не заявляет
  полного устранения, только исправление конкретной гонки наблюдения; это
  уже зафиксировано в r1 и не изменилось.
- Байт-в-байт diff `4cec874a..bf5c866e` средствами `git diff --quiet`,
  упомянутый автором в хендоффе, — инструментарий ревью не даёт
  произвольных git-команд; вместо этого выполнена эквивалентная независимая
  проверка: построчное сравнение текущего содержимого изменённых файлов с
  описанием кода в принятом r1-документе (раздел «Как проверялось» выше) —
  расхождений не найдено.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| Low: вводящий в заблуждение текст assert-сообщения при истёкшем дедлайне с терминальным состоянием (`test/review-native-runner.test.mjs:48`, снята в r1, цикл не открывала) | Не требовала правки — снята автором ревью сразу в r1 как не блокирующая; код не менялся и в этом раунде | `test/review-native-runner.test.mjs:48` (строка идентична r1), `docs/reviews/CODE-REVIEW-1115-r1.md`, раздел «Находки» |

## Унаследовано из r1

- Полный независимый разбор логики исправления, вызывающего
  production-пути (`scripts/review-native-runner.mjs` — не менялся),
  fail-closed гарантий для `R/S/D/T`, и анализ «чем доказано/чем краснеет»
  для защитного AC — принято без повторного разбора по существу, так как
  содержимое `test/review-native-runner.test.mjs` в этом раунде байт-в-байт
  совпадает с материалом r1 (`4cec874a8326`), что подтверждено построчным
  сравнением диффа и текущего файла в этом раунде. Документ:
  `docs/reviews/CODE-REVIEW-1115-r1.md`, SHA материала `4cec874a832
  6ceb4efac37cda3df2cd57c0b749c`.
- Вывод о соответствии release-ledger паттерну репозитория (`category:
  infra` без `introducedBy` — 49 действующих записей `infra` без этого
  поля) — содержимое `docs/release-ledger/v1.82.0/1115.json` не изменилось,
  повторная сверка с полным списком записей не проводилась.
- Маршрут `route: fix` по всем критериям §5 — основания (отсутствие
  src-правок, миграций, UX-контракта) не изменились после ребейза.

## Маршрут (#726)

Все критерии §5 пройдены (как и в r1): `complexity` — низкий, локальная
тестовая правка без изменений за этим раундом; `surfaces` — один файл-тест
плюс сопутствующая документация/реестр; `migration` — нет; `ux-contract` —
нет (вне `src/**`); `perf-touch` — нет; `undocumented` — поведение
зафиксировано в `docs/STATUS.md`/`docs/DEVELOPMENT.md`/release-ledger в том
же диффе. `route: fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI3NGRhODRkYTBjNDg4ZTQ3ZTJhMGMzNGMyZWRmMGQxYTdiNTc4NGUzOGQ3NDUwN2RlOWI3ZDU3M2EwZWI1NjkiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4YzBkMjg1YzNlMTY3NDM2MjRjMzQ0ZjMzMzAzM2Y2OTc3MGJlNjdiMGVjMmUwMTE1ZTM2ZjJlMWM4OTA0NmNjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJiZjVjODY2ZTQ0NzE1ODcxNjA2N2YzNjU1Yzk5NjY5YWYzOTE2NDNiIiwidHJlZSI6Ijg5Njg2YWI4YWQ2M2JkNjRjNjdiY2M1ZjY2NTYzODU3ZjcyNTRlOWEiLCJib2R5RGlnZXN0IjoiM2RkMDE2YjU3MWNhM2VmOTcyNjVmZmRhZjMxZmFkN2JhNzc2ZjczOGI1Nzc4MTIzZTg3N2YwYTBiZTkzZjc2ZSIsInByb2R1Y2VyUnVuIjoiNDA3NzIxNjAwNzYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjdlYWNiMmU0NTRkYTIzZjU2OTMzZjc1MzQ5YjEzZjAxZWQ4ZTgwNDdiNzNkZjEwMTEzZmE2OGEwYTRhOGMzYzkiLCJ2ZXJkaWN0RGlnZXN0IjoiMjE0MzFkNWIwMjJmNDk2MzFkY2Y2M2JkZWI5NTU4YmUzZTBkOTQ2MTg4NDM3ZDY2NWE1NjgyODJmMTk3ZTg4ZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI3M2UxOWExZTgzZTQ3MTFjMmVhZmVlYmIwZTM1M2Y5MjQxNTA0YjQ3MDVhNzRmNjYxMmVkOWY1NzE5ZmI4NDM4IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgxMjYxMjg2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE1I2lzc3VlY29tbWVudC02NDgxMjYxMjg2IiwiYm9keURpZ2VzdCI6ImViMjUxZGFkNGM5YTU2YWI1YzgwYmY5NmEyNmMyODI3MzgxZTAwZDMxNTIyNWRkMDRkZDJkMzZhNDA3YzkyOTgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1115-native-finalization`, коммит `bf5c866e4471` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `89686ab8ad63bd64c67bcc5f66563857f7254e9a`
  ```
  git log --all --format='%H %T' | grep 89686ab8ad63
  ```
- Тело issue: `3dd016b571ca3ef97265ffdaf31fad7ba776f738b5778123e877f0a0be93f76e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40772160076,"run_attempt":1,"digest":"d1985a8b8ff6c038b918e8a2c73765f8690005eafe3e5490588ea5fa7ce75089"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDIsIm91dHB1dF90b2tlbnMiOjE0ODUyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjkyNTExLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTQ5NzE3MSwiY29zdFVzZEVzdGltYXRlIjowLjgxODA4MjE5OTk5OTk5OTl9XSwidHVybnMiOjMyLCJkdXJhdGlvbk1zIjoxOTMyOTEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjgxODA4MjE5OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=42 output_tokens=14852 cache_creation_input_tokens=92511 cache_read_input_tokens=1497171 num_turns=32 -->
