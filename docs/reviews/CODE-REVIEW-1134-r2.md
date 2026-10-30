# CODE-REVIEW-1134-r2

Issue: #1134 · Трек: show · Этап: code · Заход r2 · Блокирующих циклов 0/2
Материал: `c3b2cc6c019818703b2674310c30253b780a5440` (база `1fa2b03467fe521d3a071c5bd7e617ebde6a542a`)

## Скоуп

Диагностика ревью-инструментария (#1082/#1134): сертификат отказов
(`scripts/review-failure-diagnostics.mjs`) получает ограниченную,
опубликованную без текста/аргументов категорию результата инструмента
(`resultMetadata`/`omittedResults` — `isError`/`contentShape`/фиксированная
категория `input-validation-error-reported | tool-error-reported |
non-error-reported | unknown`). Добавлен ручной (не CI) provider-free probe
`scripts/review-inert-grep-probe.mjs`. Документация
(`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, новый
`docs/analysis/1134-native-grep-journal.md`), release-ledger `infra`-запись и
регенерированный `ci-registry-inventory.json`. Относительно заход r1 дифф
добавляет ровно один новый файл — `docs/reviews/CODE-REVIEW-1134-r1.md`
(публикация прошлого вердикта); реализация и тесты побайтово те же, что
проверялись в r1 (сверено прямым чтением `read:diff` против новой базы
`1fa2b034`). Изменения — классы B (scripts/tests) и C (docs); продуктового
кода (class A) нет.

Коммиты материала: `4d7d0e00b fix(review): retain bounded native tool-error
categories without admission waiver (#1134)`, `c3b2cc6c0 docs: review
document for #1134`.

## Почему заход r2, а не продолжение r1

Заход r1 (материал `ef1e9cb81`) получил зелёный вердикт без находок
(comment 6524478311). После публикации `dev` продвинулся, ветку
ребейзнули на `dev@1fa2b034`, patch-id изменился — пайплайн прямо объявил
вердикт r1 неприменимым к новому дереву (comment 6524482139, §2.10, #492)
и вернул задачу в `S7-code-review` для нового независимого разбора. Это не
находка и не возврат автору — механическое следствие продвижения `dev`.

## Как проверялось

Статика — прочитаны `docs/SCOPE.md`, `AGENTS.md`, тело issue #1134 и все
комментарии (включая оба неудавшихся модельных раунда и текст r1-документа,
который сам стал частью дифа r2). `read:diff`/`read:log` прочитаны
напрямую на текущем материале `c3b2cc6c`.

Независимый разбор кода (до повторного использования выводов r1) —
прочитан полный `scripts/review-failure-diagnostics.mjs`:
- `resultMetadata()` классифицирует по ограниченному конверту: regex
  `/^\s*(?:<tool_use_error>\s*)?InputValidationError:/` якорён на начало
  первых 256 байт текста; совпадение в середине произвольного текста не
  классифицируется как `input-validation-error-reported` (подтверждено
  тестовым кейсом «Other error mentioning…» → `tool-error-reported`).
  Переменная `first` используется только в `.test()` и никуда не кладётся —
  сырой текст результата в сертификат не попадает.
- `callSummary()`: `missing-journal`/`duplicate-journal`/`forbidden-request`
  и остальные `reasons` вычисляются строго как раньше — новый код лишь
  добавляет `resultMetadata`/`omittedResults` рядом, не влияя на ветки
  принятия решения; `verdictAuthority=false` сертификата не меняется этим
  диффом.
- Ограничение на 4 элемента (`matchedResults.slice(0,4)`,
  `omittedResults=Math.max(0,resultCount-4)`) корректно для 9 дублей.
- `buildFailureCertificate()`: цикл обрезки по `FAILURE_LIMITS.certificateBytes`
  (строки 154–158) по-прежнему режет по приоритету
  `calls → metadataChannels → denials` целыми объектами звонков — рост
  размера звонка за счёт `resultMetadata` не ломает инвариант бюджета.
- `scripts/review-inert-grep-probe.mjs` (новый файл, 88 строк, прочитан
  полностью): явный отказ вне `platform==='linux'` с единственным `lo`
  интерфейсом, обязательный `--cli=/abs/...`, проверка SHA256 пина CLI,
  изолированные `HOME`/`TMPDIR`/`GIT_CONFIG_*`, синтетический API-ключ,
  сервер слушает только `127.0.0.1`, лимит тела запроса 8 МиБ, `providerRequests:0,
  modelCalls:0` в итоговом объекте. Скрипт не подключён ни к одному workflow
  (`grep review-inert-grep-probe .github` — 0 совпадений) и не используется
  как источник `resultMetadata`/`omittedResults` вне своего теста
  (`grep resultMetadata|omittedResults *.{mjs,js,ts,yml,yaml}` — только сам
  модуль и его тест).

Гейты (адресные, через `run_check`, материал `c3b2cc6c`):

| Гейт | Результат |
|---|---|
| `read:diff`, `read:log` | PASS — дифф и лог материала прочитаны напрямую |
| `unit:test/review-failure-diagnostics.test.mjs` | PASS, 26/26, 0 fail — перепрогнано независимо на `c3b2cc6c` |
| `unit:test/review-capabilities.test.mjs` | PASS — перепрогнано независимо на `c3b2cc6c` |
| `static:ci-registry-inventory` | PASS |
| `static:ci-profiles` | PASS |

Переиспользовано без повторного прогона (имплементация байт-в-байт
совпадает с проверенной в r1, validate-gate зелёный на точном текущем
материале `c3b2cc6c`,
[run 41066987499](https://github.com/Matysh/houseplan-card/actions/runs/41066987499),
«review-light proof is complete»): build/typecheck (нет изменений
TS/продукта — только `.mjs`/docs/JSON), `unit:test/review-execution-policy.test.mjs`,
`unit:test/review-native-call-digest.test.mjs`, `unit:test/ci-flake-evidence.test.mjs`,
`unit:test/golden-scene-repaint.test.mjs` (не затронуты диффом #1134),
`gate:small` (267 с, 0 ошибок на материале с идентичной реализацией —
зафиксирован в handoff с точным SHA базы).

Не прогонялось и почему: демо-смоки (нет UI/продуктового изменения),
`pytest tests_backend`/HA-harness (Python не менялся), `invariants`
(геометрия не менялась), ручной `unshare -Urn … review-inert-grep-probe.mjs`
(требует Linux network namespace с loopback — недоступно в среде ревью, не
входит в `run_check`-манифест; guard-условия и завершение проверены чтением
кода, прежний прогон документирован автором конкретными хэшами CLI/ZIP).

## Находки

Нет High. Нет Medium в скоупе.

Честно обозначенный пробел доказательства (не Medium, ограничение
инструментария ревью, не дефект задачи): полные трейлеры
`Issue:`/`User-Visible:` коммита `4d7d0e00b` не читаются доступными мне
проверками (`read:log` отдаёт только oneline, выделенного гейта для
полного тела коммита в манифесте нет). Диффу не соответствует ни один
`docs/CHANGELOG*.md`, что согласуется с ожидаемым `User-Visible: no` для
чисто инфраструктурной/диагностической задачи; явного противоречия не
нашёл. Тот же пробел был честно отмечен в r1 для предыдущего SHA — он не
устранён инструментарием ревью, но и не является находкой задачи.

### AC · чем доказан · чем краснеет

Формальных пронумерованных AC у задачи нет (issue — расследование
«Наблюдение/Что установить/Границы», не спецификация с §7.1). Ниже —
защитные инварианты, которые код фактически утверждает:

| Инвариант | Чем доказан | Чем краснеет |
|---|---|---|
| `missing-journal` остаётся отказом даже при `input-validation-error-reported` | `test/review-failure-diagnostics.test.mjs` — «#1134 result error categories remain diagnostic and never repair a missing journal», PASS на реальном `traceProblems`/`buildFailureCertificate` (не мок) | ordinary-негативный прогон того же теста на неизменённой реализации: `assert.ok(call.problems.includes('missing-journal'))` и `assert.equal(result.verdictAuthority,false)` для всех 7 форм входа |
| Секрет/текст результата никогда не попадает в сертификат | тот же тест, `assert.ok(!JSON.stringify(result).includes(secret))` для 7 форм `content`/`is_error` | тот же ordinary PASS-прогон; удаление `.slice(0,256)`/использования `first` только в `.test()` превратило бы это в падение |
| Ограничение 4 результата / `omittedResults` корректно при дублях | «#1134 missing, duplicate and excessive result rows…», PASS | `assert.equal(call.resultMetadata.length,4); assert.equal(call.omittedResults,5)` на реальных 9 дублях |
| Probe отказывается запускаться без `--cli=`/вне изолированного namespace | «#1134 native probe cannot start a CLI/provider through an ordinary no-argument invocation», PASS, реальный `spawnSync` реального файла (не мутант, не билд-патч) | `assert.equal(run.status,1); assert.match(run.stderr,/isolated network namespace\|Supply --cli=/)` |

Все четыре — результаты обычных (не мутационных) тестов на неизменённой
реализации, перепрогнаны мной независимо на материале `c3b2cc6c`
(см. таблицу гейтов выше, 26/26 PASS).

## Что проверено и корректно

- Дифф r2 относительно r1 — строго один новый файл
  (`docs/reviews/CODE-REVIEW-1134-r1.md`, публикация прошлого раунда);
  `scripts/review-failure-diagnostics.mjs`, `scripts/review-inert-grep-probe.mjs`,
  `scripts/review-capabilities.mjs`, тест и документация подсистемы —
  идентичны содержанию, проверенному в r1 (сверено прямым чтением `read:diff`
  на новой базе, а не только со слов хендоффа).
- Новая метаданность (`resultMetadata`/`omittedResults`) аддитивна и не
  меняет admission-путь (`missing-journal`, `verdictAuthority=false`) —
  проверено чтением `callSummary`/`buildFailureCertificate` и подтверждено
  независимым прогоном тестов.
- Секреты/сырой текст результата не копируются ни в одном из 7 наблюдаемых
  видов `content`/`is_error` — подтверждено чтением и тестом.
- `docs/release-ledger/v1.82.0/1134.json` — формат/поля совпадают с соседней
  `infra`-записью `1133.json`; `category: infra` корректна для этой задачи
  (нет изменений продукта/конфигурации, нет `major`/`stable-fix`), milestone
  релиза не затрагивается. `scripts/ci-registry-inventory.json` содержит обе
  требуемые записи `1134.json` в нужном месте (между `1133` и `1145`),
  `static:ci-registry-inventory` подтверждает консистентность.
- `docs/STATUS.md`: абзац про #1134 и число Node unit (5901, было 5898,
  +3 новых теста) — один источник (`npm run inventory`), один раз видимое
  число; порядок относительно уже слитых #1133/#1154 корректен, дублей и
  конфликтных маркеров нет (прочитан файл целиком после разрешения ребейза).
- Ручной `review-inert-grep-probe.mjs` не подключён ни к одному workflow и
  не используется как источник полей сертификата вне своего теста
  (оба grep пройдены на текущем материале заново).
- Задача проходит критерии §5: `complexity` (низкий риск, чисто аддитивная
  диагностика), `surfaces` (один модуль диагностики + тест + ручной probe
  той же подсистемы), `migration` (нет), `ux-contract` (нет продуктового
  UX — инфраструктура ревью), `perf-touch` (неприменимо), `undocumented`
  (поведение зафиксировано в этом же коммите в `ARCHITECTURE.md`/`DEVELOPMENT.md`/
  `docs/analysis/1134-native-grep-journal.md`) → `route: fix`.

## Чего не проверял

- Полное тело коммита/трейлеры `Issue:`/`User-Visible:` — см. «Находки»
  (ограничение доступных read/log-гейтов, не дефект задачи).
- Повторный реальный прогон ручного `unshare`-probe в изолированном network
  namespace — недоступен в среде ревью; оценка опирается на независимое
  чтение кода guard-условий (подтверждено заново на `c3b2cc6c`) и прежний
  задокументированный прогон с названными хэшами CLI/ZIP (диагностика, не
  заявляется как caught-мутант).
- Полную ночную матрицу мутантов/`ship-review`/релизные гейты — вне объёма
  `track:show` код-ревью для этой дельты (PROCESS.md §8).

## Закрытие раунда r1

Раунд r1 не вернул задачу с находками — он получил зелёный вердикт
(High: 0, Medium: 0, `docs/reviews/CODE-REVIEW-1134-r1.md`), но пайплайн
объявил его неприменимым к новому дереву из-за смены patch-id при ребейзе
на `dev@1fa2b034` (comment 6524482139, §2.10, #492). Таблица «находка | чем
закрыта» пуста — закрывать нечего, цикл r1 не был блокирующим.

| Что было в r1 | Статус в r2 |
|---|---|
| Зелёный вердикт, 0 находок, на материале `ef1e9cb81` | Признан пайплайном неприменимым к `c3b2cc6c` (другой patch-id после ребейза); заменён этим независимым разбором |

## Унаследовано из r1

Выводы r1 по существу кода (`scripts/review-failure-diagnostics.mjs`,
`scripts/review-inert-grep-probe.mjs`, тест) не унаследованы вслепую —
они повторно проверены мной независимым чтением диффа и перепрогоном
`unit:test/review-failure-diagnostics.test.mjs`/`unit:test/review-capabilities.test.mjs`/
`static:ci-registry-inventory`/`static:ci-profiles` на текущем материале
`c3b2cc6c` (а не только переиспользованы со ссылкой на r1). Переиспользовано
без повторного прогона — только build/typecheck и гейты, не относящиеся к
диффу #1134 (`unit:test/review-execution-policy.test.mjs`,
`unit:test/review-native-call-digest.test.mjs`, `unit:test/ci-flake-evidence.test.mjs`,
`unit:test/golden-scene-repaint.test.mjs`, `gate:small`) — обоснование в
разделе «Как проверялось» выше, документ r1: `docs/reviews/CODE-REVIEW-1134-r1.md`,
материал r1: `ef1e9cb814b2a1e45ad8809d514f45500e20404b`.

## Маршрут

`route: fix` — задача проходит все критерии §5 (см. выше). Маршрут
побочных находок — `mode: issues` (REVIEW_FINDINGS_POLICY), побочных
находок вне скоупа не обнаружено.

Вердикт: зелёный · заход r2 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-1134-r2.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjRjOWEzZWEyZGYwMGVmZTZhNGE2ZjQzMGQ5N2ZjOGEwYjM4M2FhZWE2MGM2Y2FjYWRkNWNlYmE3NGE2ZGMyZTMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIyNmEzZGUyNzViMzA2MWY5ZDZiYTIwNDdkOGEyYzBhOGFjMmJmNTQxNTJiMDM4MDQ5YTk4YTA0YzI5MzUwYjBmIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTM0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJjM2IyY2M2YzAxOTgxODcwM2IyNjc0MzEwYzMwMjUzYjc4MGE1NDQwIiwidHJlZSI6ImY4NGYxZDhlOTFmZTVhYTNiY2MwZGRjMmE4Y2VjZWE4MjVhMGM1ZDAiLCJib2R5RGlnZXN0IjoiN2MzMzhhMmIwMDQyMWJkZWVlMDQ2NWI0Mjg1MzU3MDg4YzU3YjUxNzU1MDQ2MGE0Zjc2ZDA2ZDUxYTE4ZmExOSIsInByb2R1Y2VyUnVuIjoiNDEwNjgxMTIxMzciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjcxZmQyZjA1NDhmYzE4YzA2ZWI0ZTkwNDliMDZiYWRjNDVjOTlkYjA4MWEyMWVjYzMwYTI1MzQ5OTIwNTg3ZjciLCJ2ZXJkaWN0RGlnZXN0IjoiZjdjYmU5NGQ5YmEyYWUwMDRkOWQ1ZDk0NTM2ZTVkYjlhZGUzNDE1ZTcwZjZlM2Y3M2UyZWIyODM0ZTM3YWYxMiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIwZTU2NDAxMzMyNjIyYmRiN2Y1MGI3MDIxNGZiMjA2YTE1ZjJhZTY5MzM4MDBjZDRhNjU5NWNiZjAyYTk1ZmE3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTI0ODIxNTA3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTM0I2lzc3VlY29tbWVudC02NTI0ODIxNTA3IiwiYm9keURpZ2VzdCI6IjUzMDljMzczZWE0Nzc4YjVkN2QwYjU2ZjQ2ODc3MDI1OWU5ZDBmY2M1ZTkxOWFkYjAyNDMyZDVjNDMwZjZlYmMifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1134-native-result-diagnostics`, коммит `c3b2cc6c0198` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f84f1d8e91fe5aa3bcc0ddc2a8cecea825a0c5d0`
  ```
  git log --all --format='%H %T' | grep f84f1d8e91fe
  ```
- Тело issue: `7c338a2b00421bdeee0465b4285357088c57b517550460a4f76d06d51a18fa19`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41068112137,"run_attempt":1,"digest":"cdce64ad857f1f4929108222cfba0215fc5afef5a43bcccda644a05bd4baa949"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzgsIm91dHB1dF90b2tlbnMiOjIyNTYwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNTU3OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE2NDk2MzksImNvc3RVc2RFc3RpbWF0ZSI6MS4wMTc5MTU4MDAwMDAwMDAxfV0sInR1cm5zIjozMCwiZHVyYXRpb25NcyI6MjY4MTQ5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4wMTc5MTU4MDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=38 output_tokens=22560 cache_creation_input_tokens=115578 cache_read_input_tokens=1649639 num_turns=30 -->
