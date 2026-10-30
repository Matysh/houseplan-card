# CODE-REVIEW-1134-r1

Issue: #1134 · Трек: show · Этап: code · Заход r1 · Блокирующих циклов 0/2
Материал: `ef1e9cb814b2a1e45ad8809d514f45500e20404b` (база dev `3ffc4621e94fc79d1677f68cb7a57939b2084d72`)

## Скоуп

Диагностика ревью-инструментария (#1082/#1134): сертификат отказов
(`scripts/review-failure-diagnostics.mjs`) получает ограниченную,
опубликованную без текста/аргументов категорию результата инструмента
(`resultMetadata`/`omittedResults`) — `isError`/`contentShape`/фиксированная
категория `input-validation-error-reported | tool-error-reported |
non-error-reported | unknown`. Добавлен ручной (не CI) provider-free
probe `scripts/review-inert-grep-probe.mjs`, воспроизводящий native
JSON-schema rejection до PreToolUse в изолированном network namespace.
Документация (`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, новый
`docs/analysis/1134-native-grep-journal.md`), release-ledger `infra`
запись и регенерированный `ci-registry-inventory.json`. Изменения —
классы B (scripts/tests) и C (docs); продуктового кода (class A) нет.
Задача — инфраструктура, входит в S7 напрямую (AGENTS.md).

Единственный коммит материала:
`ef1e9cb81 fix(review): retain bounded native tool-error categories without admission waiver (#1134)`.

## Как проверялось

Статика — прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
тело issue и все комментарии (включая два неудавшихся модельных раунда до
этого). Дифф и лог прочитаны через `read:diff`/`read:log`. Прочитан
полный `scripts/review-failure-diagnostics.mjs`, новый
`scripts/review-inert-grep-probe.mjs`, новые тесты, `docs/analysis/1134-native-grep-journal.md`,
`docs/release-ledger/v1.82.0/1134.json`, диффы `ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md`
и `scripts/review-capabilities.mjs`. Проверено, что `review-inert-grep-probe.mjs`
не подключён ни к одному workflow (`.github/**` grep — 0 совпадений) и что
новые поля сертификата (`resultMetadata`, `omittedResults`, три категории)
не используются другим строгим потребителем схемы (grep по репозиторию —
только сам файл, его тест и доки).

Независимый разбор кода — до чтения хендоффа: прослежена `resultMetadata` на
всех наблюдаемых формах `content`/`is_error` (строка/блоки/`undefined`/иное,
булево/нет), регэксп якорится на начало строки и допускает только
`InputValidationError:` с необязательным `<tool_use_error>` перед ним —
совпадение в середине произвольного текста не классифицируется как
`input-validation-error-reported` (проверено построчно и тестом «Other error
mentioning…» → `tool-error-reported`). Сам текст результата нигде не
сохраняется — только `isError`/`contentShape`/категория, `first` используется
только для `.test()`, не кладётся в объект. Пересчитана логика admission:
`callSummary` и `reasons` (включая `missing-journal`) этим диффом не
затронуты — новая метаданность строго аддитивна, отказ `missing-journal`
остаётся независимо от `resultMetadata`. Проверено ограничение на 4 элемента
(`matchedResults.slice(0,4)`/`omittedResults`) и что сериализация сертификата
по-прежнему укладывается в `FAILURE_LIMITS.certificateBytes` (функция обрезки
в `buildFailureCertificate` не менялась и не завязана на новые поля
по размеру по порядку приоритета `calls→metadataChannels→denials`).

Гейты (адресные, через `run_check`, материал не менялся):

| Гейт | Результат |
|---|---|
| `read:diff`, `read:log` | PASS — дифф и лог материала прочитаны напрямую |
| `unit:test/review-failure-diagnostics.test.mjs` | PASS, 26/26 (включая 3 новых теста #1134), 0 fail — перепрогнано независимо |
| `unit:test/review-capabilities.test.mjs` | PASS — перепрогнано независимо (хинт про native-schema в каталоге) |
| `static:ci-registry-inventory` | PASS — обе записи `1134.json` в реестре консистентны генератору |
| `static:ci-profiles` | PASS |
| `read:base:docs/STATUS.md` | использован, чтобы сверить порядок вставки абзаца #1134 относительно уже слитого #1133 — конфликта нет |

Переиспользовано без повторного прогона (валидно на этом материале,
`review-light proof is complete`, https://github.com/Matysh/houseplan-card/actions/runs/41063287644):
build/typecheck (нет изменений TS/продукта — только `.mjs`/docs/JSON),
`unit:test/review-execution-policy.test.mjs`,
`unit:test/review-native-call-digest.test.mjs` (не затронуты диффом),
`unit:test/ci-flake-evidence.test.mjs`, `unit:test/golden-scene-repaint.test.mjs`
(относятся к #1133, не к этому диффу), `gate:small` (267 с, 0 ошибок, точный SHA).

Не прогонялось и почему: демо-смоки (нет UI/продуктового изменения, AC их
не называет), `pytest tests_backend`/HA-harness (Python не менялся),
`invariants` (геометрия не менялась), ручной
`unshare -Urn … review-inert-grep-probe.mjs` (требует Linux network
namespace с loopback — недоступно в среде ревью, не входит в
`run_check`-манифест; это ручной, не CI-гейт, и его прежний прогон уже
задокументирован автором с конкретными хэшами CLI/ZIP — не мутант,
повторное исполнение не даёт новой защитной информации к тому, что уже
проверено независимо по исходному коду probe и its guard-условиям).

## Находки

Нет High. Нет Medium в скоупе.

Один честно обозначенный пробел доказательства (не Medium, инфраструктурное
ограничение инструментария ревью, не дефект задачи): полные трейлеры
`Issue:`/`User-Visible:` коммита `ef1e9cb81` не читаются доступными мне
проверками (`read:log` отдаёт только oneline-подпись, `read:diff` — только
дифф; выделенного гейта для полного тела коммита в манифесте нет). Диффу не
соответствует ни один `docs/CHANGELOG*.md`, что согласуется с ожидаемым
`User-Visible: no` для чисто инфраструктурной/диагностической задачи без
видимого пользователю поведения; явного противоречия не нашёл.

## Что проверено и корректно

- `resultMetadata` классифицирует только по известному, ограниченному
  конверту (anchored regex, первые 256 байт), никогда не сохраняет сырой
  текст результата, аргументы или секреты — подтверждено чтением и
  независимым прогоном теста, который прогоняет секрет через все семь форм
  входа и проверяет отсутствие его в сериализованном сертификате.
- Новая метаданность аддитивна: `missing-journal`/`verdictAuthority=false`
  не меняются сообщённой категорией ошибки — ни для одного из входов не
  найдено пути, где `input-validation-error-reported` подменяет отказ на
  допуск; тест это же подтверждает прогоном (не мутацией — здесь не новый
  guard, а неизменная логика admission, которую новый код не трогает).
- Ограничение на 4 результата/`omittedResults` работает и для 9 дублей
  (`resultCount=9`, `resultMetadata.length=4`, `omittedResults=5`,
  `duplicate-result` сохраняется) — прочитано и подтверждено тестом.
- Ручной probe защищён от случайного исполнения: явная проверка платформы
  и сетевых интерфейсов (кроме `lo`), проверка SHA256 пина CLI,
  изолированный HOME/Git/TMPDIR, синтетический API-ключ, loopback-only
  транспорт, 0 обращений к реальному provider/model — подтверждено чтением
  кода; скрипт не подключён ни к одному workflow (grep `.github/**` — пусто).
  Негативный тест на `node scripts/review-inert-grep-probe.mjs` без
  аргументов подтверждён независимым прогоном в составе
  `unit:test/review-failure-diagnostics.test.mjs` (PASS).
- `docs/release-ledger/v1.82.0/1134.json` — формат и поля совпадают с
  соседними `infra`-записями (например, `1133.json`); milestone релиза не
  затрагивается, что верно для `infra` без `major`/`stable-fix`.
  `scripts/ci-registry-inventory.json` содержит обе требуемые записи
  `1134.json`, и `static:ci-registry-inventory --check` подтверждает
  консистентность со штатным генератором.
  `docs/STATUS.md`: новый абзац про #1134 и обновлённый счётчик Node unit
  (5898→5901, +3 новых теста) — одно число, один источник
  (`npm run inventory`), вставлен корректно относительно уже слитого #1133.
- Задача проходит критерии §5 route: `complexity` (риск низкий, чисто
  аддитивная диагностика без изменения admission-пути), `surfaces` (один
  модуль ревью-диагностики + его тест + ручной probe той же подсистемы),
  `migration` (нет изменений конфигурации/совместимости), `ux-contract`
  (нет продуктового UX — инфраструктура ревью), `perf-touch` (не
  применимо), `undocumented` (поведение зафиксировано в этом же коммите —
  `ARCHITECTURE.md`/`DEVELOPMENT.md`/`docs/analysis/1134-native-grep-journal.md`).
  → `route: fix`.

## Чего не проверял

- Полное тело коммита/трейлеры `Issue:`/`User-Visible:` — см. раздел
  «Находки» (ограничение доступных мне read/log-гейтов, не дефект).
- Повторный реальный прогон ручного `unshare`-probe в изолированном network
  namespace — недоступен в среде ревью; оценка опирается на независимое
  чтение кода guard-условий и его прежний задокументированный прогон с
  названными хэшами CLI/ZIP (диагностика, не caught-мутант, не
  заявляется как таковая автором).
- Полную ночную матрицу мутантов/`ship-review`/релизные гейты — вне объёма
  `track:show` код-ревью для этой дельты (`PROCESS.md` §8).

## Маршрут

`route: fix` — задача проходит все критерии §5 (см. выше).

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/CODE-REVIEW-1134-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjNmZTA4NzJjNTg4YWU3YzgwY2MzZDc1M2I3OWRiZmYxODlmZjZhZTQ1NTI4NGYzNWU4NjBiYzNhY2QwOWYyMjIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxYTU4ZDViMzE3OWQyNWY4YmJlMTk2ZGJiNDFjNDcxOTc3Mjk1Njg1ZGI4MGRlZjIwMzM2ODJlZDVhZWE2YTAxIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTM0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJlZjFlOWNiODE0YjJhMWU0NWFkODgwOWQ1MTRmNDU1MDBlMjA0MDRiIiwidHJlZSI6ImJkYTM2NzUwNjM4Y2I0NmQzMTcyMDk2Mzg2ZjZiOGMxNTFiOWUxOGUiLCJib2R5RGlnZXN0IjoiN2MzMzhhMmIwMDQyMWJkZWVlMDQ2NWI0Mjg1MzU3MDg4YzU3YjUxNzU1MDQ2MGE0Zjc2ZDA2ZDUxYTE4ZmExOSIsInByb2R1Y2VyUnVuIjoiNDEwNjU4MTA3NTIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijc5NWQwZjBhZDMxYzUxZTRhN2U0YzgyOTMzODc5OWM1Njk5NWNmNTIyOGVkNDdlMjFkNDMxMzhkZDc4ZTg4MDUiLCJ2ZXJkaWN0RGlnZXN0IjoiYTNhMmNmODYwZDIzZjMzZTg5MjQ4YTE3NTMxZGRhMmEyNWNlNGVlNTIwZjk2MzE4Y2JmNDNjNTI4M2FhZmM3OCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIxYTQ3ZWRiZWJiMzkyYmNjYzQ0MDNhMTZmMzRiZWIyNzJmNTM3YTgwMDE0YzRkMDI3NWI2NjA4ZmE3YmJkYjQ3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTI0NDc4MzExLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTM0I2lzc3VlY29tbWVudC02NTI0NDc4MzExIiwiYm9keURpZ2VzdCI6ImRkYzI4NzBlOTNjNTMwNGIyZDg3NTJiODdkYWNlMmM2MzljODM5MjE0Yjc0ZjcwNTk3NjgxYTY3ZTI2ODg5MWYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1134-native-result-diagnostics`, коммит `ef1e9cb814b2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bda36750638cb46d3172096386f6b8c151b9e18e`
  ```
  git log --all --format='%H %T' | grep bda36750638c
  ```
- Тело issue: `7c338a2b00421bdeee0465b4285357088c57b517550460a4f76d06d51a18fa19`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41065810752,"run_attempt":1,"digest":"45e919ade46d5432bc61f16f89133df09dd5de5534ef5fa6b44a23821d7cf889"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDQsIm91dHB1dF90b2tlbnMiOjIxODU5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNDk0NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIwMzU4NjYsImNvc3RVc2RFc3RpbWF0ZSI6MS4wODU2MjcyfV0sInR1cm5zIjozNSwiZHVyYXRpb25NcyI6MzEwODA3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4wODU2MjcyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=44 output_tokens=21859 cache_creation_input_tokens=114944 cache_read_input_tokens=2035866 num_turns=35 -->
