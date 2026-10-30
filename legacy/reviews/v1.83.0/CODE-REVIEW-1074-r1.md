# CODE-REVIEW-1074-r1

Issue: #1074 · Трек: show · Этап: code · Заход: r1 · Материал: `9bb6f30aa7b575c633d72e5dad2acc7ccdbe3ed0`

## Скоуп

Инфраструктурный B/C-фикс CI-утилиты `scripts/task-check-source.mjs`: удалённое
получение immutable snapshot по commit SHA ранее запрашивало
`/git/trees/<sha>?recursive=1` напрямую, передавая commit SHA как есть. GitHub
принимает commit SHA как алиас на этом эндпоинте, но в ответе возвращает
именно тот алиас в поле `sha`, а не настоящий SHA дерева — старая проверка
(`!validSha(tree.sha)`) видела валидный по формату SHA и принимала его за tree
identity. Это давало ложный отказ `task proof belongs to a different source`
(подтверждённый владельцем в проде в ходе интеграции #1069, тело issue).
Исправление: сначала аутентифицировать `/git/commits/<sha>`, сверить
`commit.sha === sha` и валидный `commit.tree.sha`, затем запросить дерево по
этому `treeSha`, сверить `tree.sha === treeSha`, `truncated === false` строго
и `Array.isArray(tree.tree)`. Старый прямой запрос дерева по commit SHA удалён.

Один коммит, класс B/C (скрипт + тест + документация + release-ledger +
сгенерированный инвентарь), `Issue: #1074` / `User-Visible: no` — корректно,
продукт (class A) не менялся, changelog не требуется и не тронут.

## Как проверялось

Материал ревью совпадает с материалом, подтверждённым validate-gate
(https://github.com/Matysh/houseplan-card/actions/runs/40185558463,
"review-light proof is complete"): переиспользую этот proof, не повторяю общий
build/typecheck/gate:small. Дополнительно независимо прогнал только адресные
проверки для разобранных веток логики, поскольку защитный AC требует
проверенного «чем краснеет», а не одного заявления автора:

| Гейт | Команда | Результат | Статус |
|---|---|---|---|
| Целевой unit-файл | `node --test test/task-check-source.test.mjs` | 12/12 PASS | прогнан повторно |
| Целевой негативный сценарий | `node --test --test-name-pattern='^#1074 cold source' test/task-check-source.test.mjs` | 1/1 PASS | прогнан повторно |
| Связанные reuse/workflow юниты | `node --test test/task-check-reuse.test.mjs test/task-check-workflow.test.mjs` | 38/38 PASS (итого 50/50 с предыдущей строкой) | прогнан повторно |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | PASS, 1 ожидаемый infra-WARN (п.8, #562) | прогнан повторно |
| mutation-gate (static) | `node scripts/mutation-gate.mjs --check --changed=origin/dev..HEAD` | PASS, static-readiness definitions=188, execution=0, caught=unknown (ночной) | прогнан повторно |
| Сгенерированный инвентарь | `node scripts/ci-registry-inventory.mjs` (check-режим) | exit 0 — закоммиченный `scripts/ci-registry-inventory.json` совпадает с генератором | прогнан повторно |

Не прогонялись (не применимо к диффу): `tsc`/`build` (ни один `.ts` файл не
менялся, продукт class A не тронут), browser smokes/golden (нет изменений
отрисовки/визуала), `pytest tests_backend` (Python backend не менялся),
`npm run invariants` (геометрия не менялась), performance (не заявлен в AC и
не затронут). Полный `npm test`/`gate:small` не требуется повторно — план
материала уже подтверждён validate-gate, а дифф меняет ровно один модуль и его
прямых потребителей, которые покрыты прогнанными выше целевыми юнитами.

**Мутанты не исполнялись.** Для «чем краснеет» ниже — разбор чтением (см.
таблицу AC), подтверждённый прогоном обычных негативных input-кейсов на
неизменной (текущей, принятой) реализации; это не запуск мутанта, а обычный
negative-input case, разрешённый общей политикой.

## Независимый разбор кода

Проследил `scripts/task-check-source.mjs:26-56` (`snapshot`) и его потребителя
`loadTaskCheckContexts` → `verifyTaskCheckClaim` (`scripts/task-check-reuse.mjs:161-167`,
где `sourceSnapshot.tree !== proof.candidate.tree` даёт отказ "task proof
belongs to a different source" — именно эта строка производит симптом,
описанный в проде в теле issue).

Разобрал новую валидацию по веткам, не предполагая авторского вывода:

- `commit?.sha !== sha` — отклоняет `null`/массив/`{}`/чужой commit SHA (нет
  поля `.sha` → `undefined !== sha`, либо явное несовпадение).
- `!validSha(commit?.tree?.sha)` — optional chaining безопасно отклоняет
  отсутствующее/`null` поле `tree`, а также невалидный формат SHA.
- `tree?.sha !== treeSha` — отклоняет дерево с чужим SHA **и** конкретно
  старый баг: ответ, эхо которым является commit SHA источника/кандидата
  (ровно воспроизводит прод-дефект из тела issue), потому что `treeSha` и
  `sha` у реального коммита различны.
- `tree.truncated !== false` — строгая проверка (прежняя была `if (tree.truncated)`,
  то есть пропускала `undefined`/`0`); разобрано и подтверждено тестовыми
  кейсами `{truncated: undefined}` и `{truncated: 0}` — оба теперь отклоняются,
  раньше оба бы прошли.
- Кэширование: оба HTTP-запроса кэшируются в общей `requests`/`snapshots`
  Map по ключу пути/SHA — если `candidateSha` и `record.sha` указывают на одно
  дерево, второй `git/commits` всё равно уходит (разные commit SHA), но
  `git/trees/<tree>` переиспользуется (один и тот же путь-ключ). Подтверждено
  прогоном целевого теста (единственный `git/trees/` вызов в сети при двух
  разных commit SHA с общим деревом).
- Локальный быстрый путь (`spawnSync git rev-parse --verify`) не менялся и
  остаётся перед новой сетевой веткой — подтверждено прогоном теста, который
  проверяет реальным `git show`, что при доступном локальном объекте сетевые
  `/git/*` запросы не выполняются вовсе.
- Потребители (`scripts/task-check-reuse-cli.mjs`, `scripts/ci-proof.mjs`)
  не делают предположений о числе HTTP-запросов — проверено чтением обоих
  файлов, коллатеральных поломок не нашёл.
- Побочный эффект задержки: снятие снэпшота теперь делает до 2 последовательных
  запросов вместо одного (commit → tree), каждый с собственным 5-секундным
  `AbortSignal.timeout` (не разделяемым общим бюджетом). Прочитал вызывающий код
  в `scripts/ci-proof.mjs:780-784` — внешний `signal` не передаётся, то есть
  общего верхнего дедлайна на всю операцию нет и не было. Рост задержки на
  один сетевой round-trip в CI-шаге — не наблюдаемый пользователем эффект
  (`perf-touch` трек-критерий не задет) и не меняет ни один из существующих
  дедлайнов/гардов.

`docs/DEVELOPMENT.md` и `docs/STATUS.md` описывают ровно то, что делает код
(сверил построчно); `docs/release-ledger/v1.82.0/1074.json` — `category:
infra`, обоснование соответствует правилу «инфраструктура вне
пользовательского milestone» (REVIEWER.md, «Объём гейтов»). Сгенерированный
`scripts/ci-registry-inventory.json` воспроизводится генератором без диффа
(проверено выше).

### AC · чем доказан · чем краснеет

| AC (из тела issue) | Чем доказан | Чем краснеет |
|---|---|---|
| Аутентифицировать `/git/commits/<sha>` и взять `commit.tree.sha` до запроса дерева | `node --test test/task-check-source.test.mjs` 12/12 PASS, включая `#1074 cold source authenticates commit identity…` | Обычный негативный кейс в самом тесте: 7 вариантов искажённого commit-ответа (`null`/`[]`/`{}`/чужой sha/отсутствующий или невалидный `tree.sha`) для обеих ролей (source, candidate) — все дают `accepted:false` с reason `/commit differs from immutable source/`; проверено чтением, что старая реализация такие кейсы не отклоняла (проверка была только по формату) |
| Строго сверять identity/truncated/полноту дерева по `treeSha`, не принимать commit-алиас за tree identity | та же команда, тест `#1074 foreign, echo-commit or incomplete tree responses…` | 10 вариантов (чужой sha, эхо commit SHA источника/кандидата, `truncated:true/отсутствует/0`, нечитаемый `tree.tree`) — все дают `accepted:false` с reason `/incomplete\/foreign task-check Git tree/`; разбором подтверждено, что вариант «эхо commit SHA» — точное воспроизведение прод-дефекта, который старая проверка (`!validSha` по формату) пропускала |
| Явные отказы при недоступности API/транспорта | тест `#1074 failed commit/tree API status and transport…` | 404/403/500 на commit/tree эндпоинтах и 2 transport-сбоя — все дают `accepted:false` с совпадающим reason; проверено чтением `json()`-хелпера (`!response.ok` бросает до валидации) |
| Локальный fast-path и существующие guards не ослаблены | тест `#1074 available immutable local snapshots never request remote commit/tree bodies` сравнивает байты с `git show HEAD` | Утверждение «сеть не используется» проверяется прямой проверкой `network.calls` — не мутант, прямая ассерция на реальном Git |

## Что проверено и корректно

- Фикс закрывает ровно тот дефект, который описан в теле issue (ложный отказ
  легитимного источника из-за commit-алиаса на `/git/trees`), без ослабления
  существующих guard'ов — независимо проследил цепочку до
  `verifyTaskCheckClaim` и подтвердил, что строка отказа совпадает с той, что
  была воспроизведена в проде (#1069).
- Защитные ветки (commit identity, tree identity, truncated, formats, API/transport
  отказы, кэширование общего дерева, локальный fast-path) покрыты адресными
  тестами; переисполнение показывает их реальную работу на текущей (принятой)
  реализации, разбор чтением показывает, что именно каждая ветка ловит в
  прежней реализации.
- Трейлеры корректны (`Issue: #1074`, `User-Visible: no`, без изменений
  changelog — верно для не-пользовательского изменения).
- `docs/release-ledger/v1.82.0/1074.json`: категория `infra`, обоснование
  соответствует коду, не входит в пользовательский milestone.
- Сгенерированный `scripts/ci-registry-inventory.json` воспроизводится
  генератором без расхождений (class D, корректно обновлён вместе с текстом).
- Нет замены пути с сохранением легаси: старый прямой запрос дерева по commit
  SHA полностью удалён в том же коммите, альтернативного «оставленного» пути
  нет.
- Одно число, видимое в диффе дважды, — счётчик Node unit тестов в
  `docs/STATUS.md` (5436 → 5441); источник один (`npm run inventory`),
  инкремент на 5 соответствует пяти добавленным `test()`.

## Чего не проверял

- Реальное поведение `/git/trees/<commitSHA>` на живом GitHub API (эхо commit
  SHA в поле `sha`) — не переисполнял сетевой запрос к настоящему GitHub;
  опираюсь на диагностику, уже зафиксированную владельцем в теле issue с
  точными SHA из инцидента #1069 (`GET /git/trees/15decc62e…` → `sha=15decc62e…`,
  `GET /git/commits/15decc62e…` → `tree.sha=553eb81d…`), а не на собственное
  воспроизведение против прод-API.
- Полный `npm run gate:small`/`npm test`/браузерные smoke и golden — не
  применимо к этому B/C-диффу (нет изменений продукта, геометрии, отрисовки,
  touch, производительности); план уже подтверждён validate-gate для этого
  материала.
- Фактическую причинно-следственную связь с оригинальным failed continuation
  #1069 (автор сам явно пишет «НЕ сделано»: это отдельно подтверждённый
  remote-reader дефект, а не доказанное состояние CI-кэша конкретного прогона)
  — не относится к этому коду-ревью, не AC этой задачи.

## Критерии трека show (§5)

- complexity: низкая — один модуль, локализованная правка валидации (≤3).
- surfaces: одна поверхность — CI-утилита `task-check-source.mjs`.
- migration: нет миграции конфига/новых совместимостных полей.
- ux-contract: нет — `User-Visible: no`, инфраструктура.
- perf-touch: нет влияния на продуктовую производительность/touch (CI-only доп. round-trip, не наблюдаем пользователем).
- undocumented: поведение зафиксировано в этом же коммите (`docs/DEVELOPMENT.md`, `docs/STATUS.md`).

Все критерии пройдены — `route: fix`.

## Находки

Нет. High: 0, Medium: 0.

## Побочные находки

Побочных находок нет (доверенный снимок политики: mode=issues; Medium вне
скоупа для маршрутизации не обнаружено).

## Вердикт

Зелёный. Код корректно и узко устраняет описанный дефект, защитные ветки
доказаны тестами с явным «чем краснеет», гейты по диффу прогнаны адресно,
документация/ledger/trailers согласованы.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1074-task-source-tree-binding`, коммит `9bb6f30aa7b5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `78b29e7caa052f5e206645c25b5d862d46dad0b6`
  ```
  git log --all --format='%H %T' | grep 78b29e7caa05
  ```
- Тело issue: `25b76a9dbf2b9f6d2f3a47b3427f681d45c0eef38a3a6de76dc1d346bebe7624`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40186004435,"run_attempt":1,"digest":"d2859be079c3b7f962de083ad78317b0007816d6fc2ba31ab9839c94a866d696"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNDksIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjM0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1OCwib3V0cHV0X3Rva2VucyI6MjY1ODMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTEwODMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMzg5NTI1LCJjb3N0VXNkRXN0aW1hdGUiOjEuMTA4MTgzfV0sInR1cm5zIjozNiwiZHVyYXRpb25NcyI6MzM3MDQzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4xMTM0MTcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5207 output_tokens=26600 cache_creation_input_tokens=91083 cache_read_input_tokens=2389525 num_turns=36 -->
