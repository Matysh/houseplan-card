Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0

Материал: `129537322daea6a6d93c28b13a00f4951d00c46e` (issue #1083, этап code, трек show).
Диапазон: `git log --oneline origin/dev..HEAD` — три коммита (`129537322`,
`4b483fdb1`, `0a01c4c29`); `git diff origin/dev...HEAD` прочитан целиком через
`read:diff`.

## Скоуп

Issue #1083 — инфраструктурный follow-up после #1082: подтверждённый RED
обоих строгих docs/tooling preflight из-за `external link failed:
https://houseplan.tech/convert (timeout)`. Задача не чинит сеть/сервер и не
объявляет историческую причину старого тайм-аута установленной — она (AC1)
отделяет факты от предположений по сохранённым данным и новому наблюдению,
(AC2) устраняет подтверждённую избыточную канонизацию converter-ссылок и
добавляет пассивную bounded-диагностику сетевых этапов без ослабления
проверки, (AC3) подтверждает прохождение строгого preflight на итоговом
кандидате. Обслуживает J6 `docs/SCOPE.md` косвенно — через надёжность
инструмента, которым Core user jobs проверяются, не сам user job. Поверхность
одна: скрипт проверки внешних ссылок `scripts/check-docs.mjs` +
новый модуль `scripts/doc-link-observation.mjs` + две неинвазивные правки
URL в пользовательских гайдах. Миграций конфигурации, нового UX-контракта,
влияния на touch/performance нет; ожидаемое поведение зафиксировано в самом
теле issue (AC1-AC3) и задокументировано в `docs/DEVELOPMENT.md`/`docs/STATUS.md`.
Критерии §5 выполняются полностью → маршрут `fix`.

## Как проверялось

Static-first: прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`,
`docs/STATUS.md`, тело issue #1083 и хендофф автора — после независимого
разбора кода, не до него.

Прочитан код целиком (не по диффу, а по итоговому файлу — новый модуль
небольшой):

- `scripts/doc-link-observation.mjs` — новый модуль. `observeDocLink` обёртывает
  исходный `fetch` теми же `method: 'HEAD'`, `redirect: 'follow'`,
  `AbortSignal.timeout(8000)`, UA `houseplan-docs-check/1` — сверено построчно
  с диффом `scripts/check-docs.mjs` (старый инлайн-fetch удалён, новый вызов
  передаёт ровно `url` и callback, без новых опций). Подписки на
  `node:diagnostics_channel` (`undici:request:create/headers/error`,
  `undici:client:beforeConnect/connected/connectError/sendHeaders`,
  `net.client.socket`) строго read-only: ни один обработчик не трогает
  `response`/`error`/retry-логику, `finally` всегда отписывается
  (`subscriptions`/`sockets`) и выставляет `trace.elapsedMs` перед вызовом
  `onTrace`, обёрнутым в `try/catch`, то есть диагностика не может провалить
  или изменить исход проверки. `publicLink` обрезает query/userinfo/fragment и
  ограничивает длину 1024 — проверено, что это применяется и к `request.path`,
  и к `location`-редиректу, и к `response.url`. `events` ограничены 64,
  `sockets`-подписки — 32, с явным счётчиком `omitted`.
- `scripts/check-docs.mjs` — диф минимален: один импорт, замена инлайн-fetch на
  `observeDocLink(url, trace => console.log(...))`. Логика статусов
  (200-399 ok, 403/408/425/429/5xx → `transientHosts` warning иначе error,
  остальные коды и исключения → error/warning) не тронута ни одним символом —
  прочитана целиком до и после правки, разница только в источнике `response`.
- `docs/USER-GUIDE.md` / `docs/USER-GUIDE.ru.md` — EN-ссылка теперь ведёт на
  `https://houseplan.tech/en/convert/` (минует историческую цепочку
  редиректов), RU — на `https://houseplan.tech/convert/` (конечный слеш,
  сохраняет языковое согласование сайта). Текст вокруг не менялся.
- `docs/release-ledger/v1.82.0/1083.json` — схема и состав полей (`schema`,
  `issue`, `baseStable`, `category: "infra"`, `rationale`, `summary.ru/en`)
  совпадают по форме с уже принятыми инфра-записями `1072.json`/`1082.json` —
  сверено чтением обоих. `category: infra` обоснован: правка — тестовая/CI-
  диагностика и устранение лишнего редиректа, не новая пользовательская
  функциональность беты, `introducedBy` не требуется по той же причине, что и
  в соседних infra-записях.
- `scripts/mutation-registry.mjs` — два новых определения
  (`docs-link-deadline-extended-1083`, `docs-link-observation-exposes-url-secrets-1083`)
  с guard `node --test test/doc-link-observation.test.mjs`. Прочитаны патчи:
  первый меняет `8000` → `16000` в точном вызове `AbortSignal.timeout`, второй
  заменяет `(url.origin + url.pathname).slice(0, 1024) : null` на
  `url.href : null` (убирает редактирование query/userinfo). Логически оба
  обязаны ловиться соответствующими ассертами тестового файла (`elapsedMs <
  12000`/`timeoutMs`, `JSON.stringify(trace).includes('secret') === false`) —
  мутанты не исполнялись (политика допускает только ночной прогон), заявлена
  только статическая регистрация.
- `test/doc-link-observation.test.mjs` — пять тестов покрывают: реальный
  HTTP-редирект 308→302→200 с проверкой метода/UA/redirect на каждом хопе и
  отсутствия `secret`/`cookie` в трассе; канонический URL не порождает лишних
  запросов; 404 остаётся 404, типизированная TLS-подобная ошибка сохраняет
  `code`, не раскрывая credentials/token; реальный молчащий пир и настоящий
  8-секундный дедлайн (`{ timeout: 20000 }` на самом тесте, не на проверяемом
  коде); отписка при исключении в колбэке наблюдателя; переполнение
  событий (64/16 omitted) и `observerError`.
- Workflow/CI-wiring: `validate-product.yml`/`validate-tooling.yml`/
  `ci-profile-paths.json` — новый `test/doc-link-observation.test.mjs` добавлен
  в tooling-профиль и исключён (`!...`) из product-профиля, по аналогии с
  соседними `docs-*`/`device-contact-designer` строками — сверено по месту в
  алфавитном порядке, без дублирования и рассинхрона между четырьмя местами
  правки. `ci-registry-inventory.json` — новая запись релиз-леджера добавлена
  в оба перечисления файлов инвентаря.
- `docs/STATUS.md`/`docs/DEVELOPMENT.md` — текст формулирует именно
  разграничение факт/предположение (`AC1`): «Later success alone never
  establishes the cause of an earlier timeout», «Missing or clipped events are
  not an established failure phase» — нет ни одного перехваченного утверждения
  вида «проблема исправлена» или «причина установлена».

Адресное исполнение (единственный доступный соразмерный oracle —
`test/doc-link-observation.test.mjs`, напрямую проверяющий новый модуль и его
единственный защитный AC — 8-секундный дедлайн и отсутствие утечки секретов):

- `unit:test/doc-link-observation.test.mjs` → PASS 5/5, включая реальный пир,
  который никогда не шлёт заголовки (`duration_ms: 8004.0`, то есть дедлайн
  действительно сработал по живому таймеру, не замокан).
- `unit:test/docs-freshness.test.mjs` → PASS (не затронут правкой логически,
  но входит в ту же команду хендоффа — перепроверен вместе).
- `static:mutation-registry` → PASS по всему реестру, включая оба новых
  определения (`ok docs-link-deadline-extended-1083`,
  `ok docs-link-observation-exposes-url-secrets-1083`) — читается как
  статическая валидность (`find` встречается ровно один раз, guard назван),
  не как исполнение мутанта; это ровно допустимая по политике «обычный
  `--check`» проверка, а не caught-свидетельство.

Переиспользовано без повтора: `ciEvidence` — validate-gate run `40286354242`
на точном материале `129537322` подтверждён как green («review-light proof is
complete»), что покрывает полный strict docs/tooling preflight на итоговом
кандидате (AC3) и обычный `HP_PREPUSH_GATE=1` набор (build/typecheck/budget и
т.д., которых эта правка не касается — изменений в `src/`, `tsconfig`,
бандле нет). Повторный прогон build/typecheck не требовался: диф не
затрагивает TypeScript-код, бандл или его сборку.

## Побочная находка в диффе — не относится к материалу

`read:diff` показывает удаление `docs/reviews/SPEC-REVIEW-1073-r1.md` и
соответствующей строки/счётчиков в `docs/reviews/INDEX.md`. Это не действие
коммитов задачи: оба файла отсутствуют в объявленном `changedFiles`
(`review-context.json`), физически отсутствуют в рабочей копии по пути
`docs/reviews/SPEC-REVIEW-1073-r1.md` (проверено `Read`/`Glob` — файла нет),
а `read:base:docs/reviews/INDEX.md` подтверждает, что именно *база* (`origin/dev`,
которая на один коммит впереди материала — уже отмечено в контексте задачи)
содержит эту запись, а материал #1083 — нет. Вывод: это чистый артефакт
нериребейзнутой ветки (`dev` ушёл на один коммит вперёд, опубликовав ревью
#1073, которого нет в предке материала #1083), а не удаление чужого
документа коммитами этой задачи. При ребейзе на слиянии это разрешится без
конфликта, как и указано в контексте раунда. Находкой не считаю.

## Находки

Нет ни одной находки — ни High, ни Medium, ни вне скоупа.

Отдельно отмечаю (не как находку, ниже порога «конкретное последствие» для
Medium): в `docs/USER-GUIDE.md` текст ссылки `[houseplan.tech/convert]`
теперь указывает на `https://houseplan.tech/en/convert/` — видимый текст
перестал дословно совпадать с путём назначения (в RU-версии текст и путь
совпадают благодаря добавленному слешу). Переход по ссылке работает корректно
и ведёт на правильную страницу; расхождение чисто косметическое (видимый
текст vs фактический href) и не искажает функциональность — не поднимаю его
до Medium.

## Что проверено и корректно

- AC1: трассировка и документация последовательно разделяют факт/предположение,
  нигде не заявляют установленной причины старого RED по одному новому PASS.
- AC2: исходный контракт (`HEAD`/`follow`/8s/UA) воспроизведён в новом модуле
  побайтово по сравнению со старым инлайн-кодом; обработка статусов,
  `transientHosts`-allowlist и строгий/warn-режим не изменены. Диагностика не
  протекает в результат (подтверждено тестом «observer callbacks cannot change
  the result»), секреты/куки/credentials/query не попадают в trace (три
  отдельных теста это бьют по разным путям данных — path, location-редирект,
  thrown error). Реальный 8-секундный дедлайн не удлинился (исполнено, не
  прочитано).
- AC3: ссылка на принятый зелёный `validate-gate` (`40286354242`) на точном
  SHA материала покрывает итоговый strict preflight; исходные RED attempts
  сохранены в теле issue как ссылки на конкретные `run/attempt/job`.
- Инфраструктурная классификация релиз-леджера (`category: infra`, без
  `introducedBy`) соответствует формату и духу соседних инфра-записей
  (#1072, #1082); User-Visible-поведение продукта не меняется — changelog не
  трогается, что согласуется с отсутствием правок в нём.
- Нумерация тестов в `docs/STATUS.md` (5591 → 5596) точно соответствует пяти
  новым тестам нового файла — не найдено второго источника той же цифры с
  рассинхроном.
- CI-wiring (`validate-product.yml`, `validate-tooling.yml`,
  `ci-profile-paths.json`) добавляет новый тестовый файл в правильный профиль
  во всех четырёх местах без дублирования и пропуска.

## Чего не проверял

- Не перепроверял серверные/сетевые криминалистические данные из тела issue
  (записи Caddy, окно UFW, пара HEAD/GET с Windows-машины) — это внешняя
  инфраструктура вне репозитория и вне диффа; не являются частью кода под
  ревью, доказательством код-ревью не выступают и не требовались для оценки
  правок.
- Не запускал `build:build`/`build:typecheck`/`build:bundle:sync` — диф не
  трогает TypeScript/бандл; достаточное переиспользуемое доказательство —
  принятый зелёный `validate-gate` на этом же SHA.
- Не запускал браузерные smoke — тело issue не называет смок явно, правка не
  трогает демо/UI.
- Не исполнял зарегистрированные mutant-свидетельства
  (`docs-link-deadline-extended-1083`,
  `docs-link-observation-exposes-url-secrets-1083`) — запрещено вне ночного
  прогона; проверена только их статическая корректность регистрации.
- Не перепроверял `test/testing-doc.test.mjs` — файл не входит в объявленный
  `changedFiles` материала, упомянут в хендоффе как побочная история
  авторского процесса, не связан логически с кодом AC1-AC3.

## Гейты — что прогнано и почему

| Гейт | Прогнан | Почему |
|---|---|---|
| `unit:test/doc-link-observation.test.mjs` | Да — 5/5 PASS | Единственный прямой oracle для нового модуля и его защитного AC2 (8s-дедлайн, отсутствие утечки секретов); реальный таймаут исполнен (не прочитан) |
| `unit:test/docs-freshness.test.mjs` | Да — PASS | Указан автором в той же команде, затронут общим `check-docs.mjs` путём импорта |
| `static:mutation-registry` | Да — PASS (read-only) | Подтверждает статическую валидность двух новых witness-определений без их исполнения (политика #905) |
| `build:build`/`build:typecheck`/`build:bundle:sync` | Нет | Диф не содержит TS/src/бандл изменений; покрыто переиспользуемым зелёным `validate-gate` на этом же SHA |
| Браузерные smoke | Нет | Тело issue не называет смок; изменения не касаются UI/демо |
| Исполнение mutant-свидетельств | Нет | Запрещено вне ночного workflow; статическая регистрация — достаточное доказательство AC2 на этом этапе |
| Серверные/сетевые криминалистические проверки из тела issue | Нет | Вне репозитория и вне диффа, не часть материала код-ревью |

## Маршрут

route: `fix`. Все критерии §5 выполнены: сложность/риск низкие (один новый
небольшой модуль + replacement вызова + два URL + CI-wiring), одна
поверхность (docs-link checker), нет миграции конфигурации, нет нового
UX-контракта (внутренний diagnostic-инструмент + эквивалентная по назначению
ссылка в гайде), нет влияния на производительность/touch, ожидаемое поведение
зафиксировано в самом теле issue (AC1-AC3) и в `docs/DEVELOPMENT.md`.

## Побочные находки (REVIEW_FINDINGS_POLICY: mode=issues)

Побочных находок нет. Единственное отклонение в диффе (удаление
`SPEC-REVIEW-1073-r1.md`/строки INDEX) разобрано выше и отнесено к
неустранённому отставанию ветки от `dev` (ожидаемое поведение трека show),
не к действию материала — отдельного issue не заводится.

## Вердикт

Зелёный. Диф меняет ровно один внутренний diagnostic-путь (`scripts/check-docs.mjs`
→ `scripts/doc-link-observation.mjs`) без изменения наблюдаемого решения о
статусе ссылки, сохраняет исходный HEAD/follow/8s/UA-контракт побайтово,
добавляет только bounded passive-метаданные с проверенным (исполнением, не
чтением) отсутствием утечки секретов и нерасширением дедлайна, устраняет
подтверждённую лишнюю канонизацию двух converter-ссылок и честно разделяет
факт/предположение об исторической причине тайм-аута, не объявляя её
установленной. CI-wiring и release-ledger корректны и согласованы по форме с
соседними инфра-записями. High и Medium находок нет.

`Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0`

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjQzMjM0NzU0NDM5Y2RhNDllYzhlNzBjNGIyODcwOTAxMDRjNDU2YjIwNDJiNWI0YWQzNDc0YmIzODNhYmJjNGEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlZjhhNzQ0MGIwMTM0YjBhNzg3OWMwNGIxNWFkMDFlZTcyZjNlZGQ4OTU4OGM1Yzg4NjUxNjU4YmEyN2ZhZWM4IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDgzLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIxMjk1MzczMjJkYWVhNmE2ZDkzYzI4YjEzYTAwZjQ5NTFkMDBjNDZlIiwidHJlZSI6IjYxMWYwOGE1NmRlMmUxZTM2ZjVlMTg3ODliYTQ4OTgwOTMyN2IwZjEiLCJib2R5RGlnZXN0IjoiMGEzNmE0Mzc0MDg4YmJkMjNhOGIzZmQ4YjM5NjAxZjg5YTFjNmYyNjgyYTAyNmY3MTczYWY3ZTg2MjIyMDVmOSIsInByb2R1Y2VyUnVuIjoiNDAyODY5OTQyOTYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjJiZDE0MGNiZmM0MjZhZWNlMmE4ZjBlMzVkYmRjZTk3NTMzNWE2ZDJlOTYzNzhkMzUxNGVmMTkyOWIwYjZmMWMiLCJ2ZXJkaWN0RGlnZXN0IjoiMGE1MTEyYzg2ZDMzYTA3ZDUzYTRiNjk1Y2ZjNmMxY2VhYzQ5MWM0YTU3ODhhZGRkY2ZjYzQ0NGIyNTlhYTRjNCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI5NGU3NzMyOWFmZjNkZTRiNGExNDNkMzc3M2FiNDg1OGVlMmFjMjM4MGMzMDlmMTJiZGM1M2U5NDQxZTNjMzYwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDEwODc4NDU5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDgzI2lzc3VlY29tbWVudC02NDEwODc4NDU5IiwiYm9keURpZ2VzdCI6IjQ0MzBjNjZmMWU2NjhiZmQzNWVjZDE5OGQ1YTIzMmE4NzNhZjVlOWJjZjNjZDFiYTZlMjlmMzA0Mzk4NjE4NjcifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1083-doc-link-timeout`, коммит `129537322dae` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `611f08a56de2e1e36f5e18789ba489809327b0f1`
  ```
  git log --all --format='%H %T' | grep 611f08a56de2
  ```
- Тело issue: `0a36a4374088bbd23a8b3fd8b39601f89a1c6f2682a026f7173af7e8622205f9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40286994296,"run_attempt":1,"digest":"97e1393f5be8b7e0dd9e6d4dd49237cba22e8532be1be567c67a5ffbfe13f014"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzgsIm91dHB1dF90b2tlbnMiOjI1NTk4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwNzE4NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE1MjExMTMsImNvc3RVc2RFc3RpbWF0ZSI6MC45ODkwMjY1OTk5OTk5OTk4fV0sInR1cm5zIjozMiwiZHVyYXRpb25NcyI6MzU4MDcwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC45ODkwMjY1OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=38 output_tokens=25598 cache_creation_input_tokens=107187 cache_read_input_tokens=1521113 num_turns=32 -->
