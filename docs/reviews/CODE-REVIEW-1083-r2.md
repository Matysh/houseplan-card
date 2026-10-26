Вердикт: зелёный · заход r2 · блокирующих циклов 0/2 · High: 0 · Medium: 0

Материал: `0f981295970c5c240cdc2dcc53a1d47971fb6e28` (issue #1083, этап code, трек show).
Диапазон: `git log --oneline origin/dev..HEAD` (`read:log`) — пять коммитов: `4e3cfb89a`,
`ac3d8794b`, `fc20dc93d` (три исходных коммита реализации, те же, что в r1, под
новыми short-SHA после ребейза на ушедший вперёд `dev`), `d9e128ea1` (публикация
`docs/reviews/CODE-REVIEW-1083-r1.md`) и `0f9812959` (перегенерация
`docs/reviews/INDEX.md` после возврата `SPEC-REVIEW-1073-r1.md` в базу).
`git diff origin/dev...HEAD` прочитан целиком через `read:diff`.

## Скоуп

Issue #1083 не изменилась с r1 — тот же инфраструктурный follow-up после #1082
(AC1 отделяет факты от предположений об историческом CI-only timeout,
AC2 устраняет подтверждённую избыточную канонизацию converter-ссылок и
добавляет пассивную bounded-диагностику без ослабления проверки, AC3
подтверждает прохождение строгого preflight на итоговом кандидате). Критерии
§5 выполняются так же, как в r1 (см. «Унаследовано из r1») → маршрут `fix`.

Между r1 и r2 `dev` дважды продвинулся вперёд (см. комментарии владельца
6410880580/6411008994/6411204341): сначала на коммит с `SPEC-REVIEW-1073-r1.md`,
затем ещё раз. Конвейер по PROCESS.md §10 (#499) дважды подготовил свежего
кандидата на новой базе и один раз повторно применил принятый зелёный
вердикт без вызова модели, когда diff относительно исходного зелёного
`129537322` вне `docs/reviews/**` был пуст. Нынешний материал `0f981295` —
результат этого ребейза плюс публикация самого r1-документа в дерево ветки.

## Как проверялось

Static-first: прочитан `review-context.json` (тело issue, хендофф, `ciEvidence`),
`REVIEW_FINDINGS_POLICY` (mode=issues), ранее опубликованный
`docs/reviews/CODE-REVIEW-1083-r1.md` — целиком, как основной источник
принятого анализа (round 2 — разбор по дельте, PROCESS.md §2.10).

Независимая проверка дельты: `read:diff` на материале `0f981295` сопоставлен
построчно с диффом, зафиксированным в `CODE-REVIEW-1083-r1.md` (раздел «Как
проверялось»). Результат — **весь продуктовый и тестовый дифф идентичен
r1 байт в байт**:

- `scripts/doc-link-observation.mjs` (новый файл, 92 строки) — тот же текст,
  тот же `observeDocLink`, тот же `HEAD`/`follow`/`AbortSignal.timeout(8000)`/UA
  `houseplan-docs-check/1`, те же лимиты `events<64`/`sockets<32`, та же обрезка
  `publicLink` до `url.origin + url.pathname`, 1024 символа.
- `scripts/check-docs.mjs` — тот же минимальный дифф (один импорт, замена
  инлайн-`fetch` на `observeDocLink(url, trace => console.log(...))`), логика
  статусов (`200-399` ok, `403/408/425/429/5xx` → `transientHosts` warning
  иначе error) не тронута.
- `test/doc-link-observation.test.mjs` (новый файл, 94 строки, 5 тестов) —
  идентичен: реальный HTTP-редирект 308→302→200 с проверкой метода/UA/без
  утечки `secret`/`cookie`; канонический URL без лишних запросов; 404/TLS-like
  error; настоящий молчащий пир и 8-секундный дедлайн (`{ timeout: 20000 }` на
  тесте); отписка при исключении в колбэке; переполнение событий (64/16
  omitted).
- `scripts/mutation-registry.mjs` — те же два новых witness-определения
  (`docs-link-deadline-extended-1083`: `8000`→`16000`;
  `docs-link-observation-exposes-url-secrets-1083`: убирает обрезку
  query/userinfo), тот же guard `node --test test/doc-link-observation.test.mjs`.
- `.github/workflows/validate-product.yml`/`validate-tooling.yml`/
  `scripts/ci-profile-paths.json` — тот же новый файл добавлен в tooling-профиль
  и исключён из product-профиля во всех четырёх местах, без дублирования.
- `scripts/ci-registry-inventory.json` — та же новая запись `1083.json`
  добавлена в оба перечисления.
- `docs/USER-GUIDE.md`/`docs/USER-GUIDE.ru.md` — те же два URL
  (`https://houseplan.tech/en/convert/` и `https://houseplan.tech/convert/`),
  текст вокруг не менялся.
- `docs/release-ledger/v1.82.0/1083.json` — тот же состав полей
  (`category: "infra"`, `rationale`, `summary.ru/en`).
- `docs/DEVELOPMENT.md`/`docs/STATUS.md` — тот же текст про разделение
  факт/предположение («Later success alone never establishes the cause of an
  earlier timeout», «Missing or clipped events are not an established failure
  phase»). Счётчик тестов в `docs/STATUS.md` на этот раз показывает
  `5593 → 5598` (а не `5591 → 5596`, как в r1) — разница в базовом числе
  объясняется тем, что `dev` продвинулся на другие задачи между раундами;
  дельта по-прежнему ровно +5 — столько же тестов добавляет
  `test/doc-link-observation.test.mjs`, второго источника той же цифры с
  рассинхроном не найдено.

Единственное реальное изменение дерева относительно r1 — два новых коммита:
`d9e128ea1` добавляет `docs/reviews/CODE-REVIEW-1083-r1.md` (публикация
принятого r1-вердикта в ветку), `0f9812959` обновляет
`docs/reviews/INDEX.md` (строка `#1083` добавлена, счётчики «Документов: 141→142,
issue: 72→73»; при этом сам `docs/reviews/INDEX.md` на этот раз содержит
обычную строку `SPEC-REVIEW-1073-r1.md`, которой не было видно в r1 — см.
ниже «Закрытие раунда r1»). Оба файла — generated/published содержимое
конвейера, не авторский код задачи; `docs/reviews/CODE-REVIEW-1083-r1.md`
сверен построчно с опубликованным документом и соответствует публикационной
квитанции в последнем комментарии владельца (`hp:review-publication` в
6410878459 с тем же `reportDigest`/`verdictDigest`).

Переиспользовано без повтора (материал/тесты/код под тестами не изменились
между r1 и r2 — подтверждено построчным сравнением диффов выше, не
предположением):

- `unit:test/doc-link-observation.test.mjs` → PASS 5/5 (r1), входы (тестовый
  файл и `scripts/doc-link-observation.mjs`) идентичны байт в байт — повторный
  прогон не требуется по правилу «не повторяй уже пригодный check».
- `unit:test/docs-freshness.test.mjs` → PASS (r1), не затронут.
- `static:mutation-registry` → PASS (r1) по обоим новым witness-определениям,
  патчи идентичны.
- `ciEvidence` — `validate-gate` run `40290307949` подтверждён зелёным
  **на точном текущем материале `0f981295`** («review-light proof is
  complete»), что покрывает полный strict docs/tooling preflight на итоговом
  кандидате (AC3) заново, уже после ребейзов. Это более свежее и более
  точное по SHA доказательство AC3, чем r1-шная ссылка на `40286354242`
  (материал `129537322`).
- `build:build`/`build:typecheck`/`build:bundle:sync` не запускались — дифф
  по-прежнему не содержит TypeScript/бандл изменений (подтверждено тем же
  построчным сравнением), покрыто тем же переиспользуемым зелёным
  `validate-gate`.
- Браузерные smoke не запускались — тело issue не называет смок, изменения
  не касаются UI/демо; это не изменилось с r1.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| r1 был зелёным, находок не было. Единственное отмеченное в r1 отклонение — удаление `docs/reviews/SPEC-REVIEW-1073-r1.md` и строки `INDEX.md` — уже тогда было классифицировано не как находка, а как артефакт неребейзнутой ветки (`dev` на тот момент был на коммит впереди материала) | Ребейз на новый `dev` (коммиты между r1 и r2, см. комментарии 6410880580/6411008994/6411204341) вернул `SPEC-REVIEW-1073-r1.md` в предка ветки | `docs/reviews/SPEC-REVIEW-1073-r1.md` физически присутствует в рабочей копии (`Glob` подтверждает), `read:diff` на материале `0f981295` больше не показывает его удаления — артефакт разрешился сам собой, как и было предсказано в r1 |

## Унаследовано из r1

Весь анализ AC1–AC3 и качества кода принимается без повторной проверки «с
нуля» — дифф, который его подтверждает, идентичен байт в байт (см. «Как
проверялось» выше), отдельно по каждому файлу сверено построчно, а не
принято на слово:

- AC1 (разделение факта и предположения об историческом timeout) — разобран и
  подтверждён в `docs/reviews/CODE-REVIEW-1083-r1.md` (материал `129537322`,
  дерево `611f08a56de2e1e36f5e18789ba489809327b0f1`), раздел «Что проверено и
  корректно», пункт AC1.
- AC2 (контракт `HEAD`/`follow`/8s/UA воспроизведён побайтово, диагностика не
  протекает в результат, секреты/куки/credentials не попадают в trace,
  дедлайн не удлинён — подтверждено исполнением, не чтением) — тот же
  документ, пункт AC2.
- AC3 (строгий preflight на итоговом кандидате) — тот же документ, пункт AC3;
  в r2 это же AC дополнительно переподтверждено более свежим `validate-gate`
  `40290307949` на точном текущем SHA (см. «Как проверялось» выше) — это
  усиление, а не замена наследуемого доказательства.
- Качество кода (однозначность, отсутствие дублирования, корректность CI-wiring
  и release-ledger `category: infra`) — тот же документ, разделы «Как
  проверялось» и «Что проверено и корректно».

Источник: `docs/reviews/CODE-REVIEW-1083-r1.md`, SHA материала `129537322daea6a6d93c28b13a00f4951d00c46e`.

## Находки

Нет ни одной находки — ни High, ни Medium, ни вне скоупа. Независимый
построчный разбор дельты между r1 и r2 не выявил ничего, что отличалось бы
от уже принятого в r1 анализа, кроме публикации самого r1-документа и
восстановления `SPEC-REVIEW-1073-r1.md` после ребейза (оба — ожидаемое
поведение конвейера, не предмет авторского кода задачи).

## Что проверено и корректно

- Продуктовый/тестовый/CI-wiring дифф материала `0f981295` идентичен диффу,
  уже разобранному и принятому в r1, — построчно сверено по `read:diff`, не
  принято на основании хендоффа или ссылки на SHA.
- `docs/reviews/CODE-REVIEW-1083-r1.md`, добавленный в дерево коммитом
  `d9e128ea1`, дословно совпадает с опубликованным документом r1 и его
  цифровой квитанцией (`reportDigest`/`verdictDigest` в комментарии
  6410878459).
- `docs/reviews/INDEX.md` (коммит `0f9812959`) корректно отражает добавление
  строки `#1083 · code · r1 · 🟢 · 0 · 0`, счётчики «Документов»/«issue»
  увеличены на 1 каждый, формат строки соответствует соседним.
- Ранее отмеченный в r1 артефакт (удаление `SPEC-REVIEW-1073-r1.md`) сам
  разрешился после ребейза — файл на месте, `INDEX.md` его не теряет.
- `ciEvidence` (`validate-gate` `40290307949`) подтверждён зелёным именно на
  текущем материале `0f981295`, что покрывает AC3 заново на точном SHA после
  обоих ребейзов dev.

## Чего не проверял

- Не повторял исполнение `unit:test/doc-link-observation.test.mjs`,
  `unit:test/docs-freshness.test.mjs`, `static:mutation-registry` — их входы
  (проверяемый код и сами тесты) не изменились между r1 и r2, что подтверждено
  построчным сравнением диффов, а не предположением о неизменности материала.
- Не запускал `build:build`/`build:typecheck`/`build:bundle:sync` — дифф по
  прежнему не касается TypeScript/бандла; покрыто переиспользуемым зелёным
  `validate-gate` на текущем SHA.
- Не запускал браузерные smoke — тело issue их не называет, изменения не
  касаются UI/демо.
- Не исполнял зарегистрированные mutant-свидетельства
  (`docs-link-deadline-extended-1083`,
  `docs-link-observation-exposes-url-secrets-1083`) — запрещено вне ночного
  прогона; патчи идентичны r1, где уже подтверждена их статическая
  корректность.
- Не перепроверял серверные/сетевые криминалистические данные из тела issue
  (Caddy/UFW/Windows-замеры) — вне репозитория и вне диффа, не изменились со
  времени r1.

## Гейты — что прогнано и почему

| Гейт | Прогнан | Почему |
|---|---|---|
| `read:log` | Да | Подтвердить состав и порядок коммитов текущего материала после ребейзов |
| `read:diff` | Да | Независимое построчное сравнение дельты r1→r2; единственный способ установить, что продуктовый код не менялся |
| `unit:test/doc-link-observation.test.mjs` | Нет (переиспользован r1, 5/5 PASS) | Вход (тест + проверяемый код) идентичен байт в байт — подтверждено `read:diff`, а не предположением |
| `unit:test/docs-freshness.test.mjs` | Нет (переиспользован r1, PASS) | Тот же файл, не затронут |
| `static:mutation-registry` | Нет (переиспользован r1, PASS) | Патчи двух witness-определений идентичны r1 |
| `build:build`/`build:typecheck`/`build:bundle:sync` | Нет | Дифф не содержит TS/src/бандл изменений ни в r1, ни в r2 |
| Браузерные smoke | Нет | Тело issue не называет смок; изменения не касаются UI/демо |
| Исполнение mutant-свидетельств | Нет | Запрещено вне ночного workflow |
| `ciEvidence` (`validate-gate` `40290307949`) | Переиспользован как существующее доказательство | Подтверждён зелёным на точном текущем SHA `0f981295` — покрывает AC3 заново после обоих ребейзов |

## Маршрут

route: `fix`. Критерии §5 не изменились относительно r1: сложность/риск
низкие, одна поверхность (docs-link checker), нет миграции конфигурации, нет
нового UX-контракта, нет влияния на производительность/touch, ожидаемое
поведение зафиксировано в теле issue (AC1–AC3) и в `docs/DEVELOPMENT.md`.
Два новых коммита раунда (публикация r1-документа и перегенерация индекса)
сами по себе инфраструктурные/генерируемые и не меняют эту оценку.

## Побочные находки (REVIEW_FINDINGS_POLICY: mode=issues)

Побочных находок нет.

## Вердикт

Зелёный. Материал `0f981295` отличается от уже принятого зелёного `129537322`
исключительно публикацией r1-документа ревью и перегенерацией индекса после
двух ребейзов на ушедший вперёд `dev` (PROCESS.md §10, #499) — построчное
сравнение `read:diff` подтверждает, что весь продуктовый, тестовый и
CI-wiring код идентичен байт в байт. AC1–AC3 и качество кода остаются
доказанными анализом и исполнением из `docs/reviews/CODE-REVIEW-1083-r1.md`;
AC3 дополнительно переподтверждён более свежим зелёным `validate-gate`
(`40290307949`) на точном текущем SHA. Единственное отклонение, отмеченное в
r1 (отсутствие `SPEC-REVIEW-1073-r1.md`), разрешилось само после ребейза и
не являлось действием материала. High и Medium находок нет, побочных находок
нет.

`Вердикт: зелёный · заход r2 · блокирующих циклов 0/2 · High: 0 · Medium: 0`

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImIxYzY2NmE3NzY0OGQxM2M3NzRkNjRkZmY0N2ZkODUyZDMyMmE2MmMyYjFjMDM1MDAyZGI0MjU2YTIyZjE5OWYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJmODUxYTc0MjUxNjcxZTM2ZTFhOGZkMTZkYjI0OWZkNDUxZDYxNTFlZjg5Y2UxMTJiMjBjZjFlZWQ3ZmM4N2VlIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDgzLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiIwZjk4MTI5NTk3MGM1YzI0MGNkYzJkY2M1M2ExZDQ3OTcxZmI2ZTI4IiwidHJlZSI6Ijk3NzI5NmM3NWZmNmI1Mjg5OGIxMzU5Y2ZlZTY1NDI4YTFhZDNhMjIiLCJib2R5RGlnZXN0IjoiMGEzNmE0Mzc0MDg4YmJkMjNhOGIzZmQ4YjM5NjAxZjg5YTFjNmYyNjgyYTAyNmY3MTczYWY3ZTg2MjIyMDVmOSIsInByb2R1Y2VyUnVuIjoiNDAyOTExMTIxNTQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImFmY2U3ZDdhNzc3MmYxYzEyNTMyZGM1Mjg3ZjIzNDM4ZDhiZTEwYzcyNmQ0NDBkZjdjY2QyMGNlOTFiM2JkMmQiLCJ2ZXJkaWN0RGlnZXN0IjoiNDdhNmZmMzY0MDNlZTkzNWQ4OTY1ZjQ4ZjExYzZjMTYxMzUxMmZmN2FmZTZiNDhlZTFkNTM3MDc1MzFlZTViNSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI2MTIxNDZlNWQ5MjE1OWRjODU2YzMzN2E5ZTBiNTFkM2Q3NDI0YzkyZTNjYTBkOGQwYmIxOTY5MTQ1YWU3YzQ1IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDExNDYwMTExLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDgzI2lzc3VlY29tbWVudC02NDExNDYwMTExIiwiYm9keURpZ2VzdCI6IjJkMzg4NTZmNTQ1NzgxMGVmNTJiNzMzMzgyNTdlYmI4ZWU5YzUwZWI0MGQzMzE0MGJjN2YzMmEzZWU0YTg1MWEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1083-doc-link-timeout`, коммит `0f981295970c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `977296c75ff6b52898b1359cfee65428a1ad3a22`
  ```
  git log --all --format='%H %T' | grep 977296c75ff6
  ```
- Тело issue: `0a36a4374088bbd23a8b3fd8b39601f89a1c6f2682a026f7173af7e8622205f9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40291112154,"run_attempt":1,"digest":"56f9e4f0d87f69c65c1b0958ea74f40c0376820aa10bb9e94380aaacbb16fef9"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjAsIm91dHB1dF90b2tlbnMiOjE1NDA0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwMDg4MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjYxNTY5NSwiY29zdFVzZEVzdGltYXRlIjowLjY4MDc0M31dLCJ0dXJucyI6MTYsImR1cmF0aW9uTXMiOjE4ODUwNywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNjgwNzQzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=20 output_tokens=15404 cache_creation_input_tokens=100881 cache_read_input_tokens=615695 num_turns=16 -->
