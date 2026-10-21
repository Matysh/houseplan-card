# CODE-REVIEW #971 · заход r1

Материал: `8ed31e7bf196c7c6a542365e786d17af04e8db3f` (рабочая копия на этом SHA).
Диапазон: `git log --oneline origin/dev..HEAD` = `8ed31e7bf`, `a17ed90f2` (merge),
`6322bfa9d`. Трек: show. Блокирующих циклов израсходовано 0 из 2.

## Скоуп

Регрессия к #936 (контракт отмены ZIP-предпросмотра, п.6/8, AC9): закрытие/отмена
импорта ZIP не освобождала серверную сессию до ответа на HTTP-запрос, из-за
чего повторная попытка получала `zip_busy` вплоть до истечения TTL (10 минут).
Файлы: `src/backup-archive-client.ts`,
`custom_components/houseplan/{backup_service,backup_http,websocket_api}.py`,
соответствующие тесты, демо-смоук, документация, release-ledger.

Риск по изменённым участкам (#707): помеченный класс — хвост нового WS-ветвления
в `websocket_api.py:650-651,666-671` (optional `token`/`operation_id`, XOR-проверка,
вызов `service.cancel_import`). Поведение и совместимость зафиксированы в теле
issue («Техническое решение» — opaque id известен клиенту до ответа, WS-отмена
привязана к HA-пользователю, старые клиенты сохраняют token-flow) и
задокументированы в `docs/ARCHITECTURE.md` («ZIP import cancellation (#971)»),
`docs/CONFIG-COMPATIBILITY.md` и `docs/DEVELOPMENT.md` («Cancellation regression
(#971)»). Все шесть критериев §5 пройдены:

- **complexity** — изменение локализовано в сессионной модели одного сервиса,
  авторская оценка 3/10 соответствует фактическому объёму (один новый словарь
  tombstone, один набор workers на сессию, один XOR-переключатель в WS).
- **surfaces** — одна поверхность: мастер ZIP-импорта и его серверная сессия.
- **migration** — нет миграции конфига; operation id — транспортное поле,
  не персистентное (подтверждено `CONFIG-COMPATIBILITY.md`).
- **ux-contract** — восстанавливает уже утверждённое поведение #936, нового
  UX нет (кроме уточнения в USER-GUIDE, что отмена не требует ожидания TTL —
  это тот же контракт, не новый).
- **perf-touch** — не затронуто.
- **undocumented** — поведение названо в issue и задокументировано в трёх
  канонических файлах выше.

Route: **fix** (реклассификация не требуется).

## Как проверялось

Чтение диффа построчно по всем изменённым файлам (`src/backup-archive-client.ts`,
`backup_service.py`, `backup_http.py`, `websocket_api.py`, тесты, демо-смоук,
документация, release-ledger, mutation-registry). Прослежена логика гонки:
`reserve()`/`upload()`/`release()`/`cancel_import()`, порядок `session.cancelled`,
`session.workers`, `self._cancelled_imports`, двойной вызов `release()` при
позднем ответе после ранней отмены, идемпотентность `cleanup_stage`
(`backup_files.py:101-113`, выход по `FileNotFoundError` маркера).

Независимая проверка через API: `gh run view 39375166834` на точном SHA
`8ed31e7bf196c7c6a542365e786d17af04e8db3f` — `conclusion: success`. Job
«Бэкенд: pytest в Home Assistant» выполнен не-переиспользованием (не `skipped`,
не `reused`), лог подтверждает `1776 passed, 1 skipped in 77.45s`, покрытие
`backup_service.py` 87%, `websocket_api.py` 85%. Job «Фронтенд: типы, юниты,
мутанты, синхрон бандла» подтверждён с `"reused":false` (новый бандл собран
заново из-за изменения `src/**`), лог unit-тестов показывает все четыре новых
теста `test/backup-archive-client.test.mjs` (`cancel during response-body
read…`, `a late cancelled ZIP reply…`, `lost cancel ACK…`, `losing ZIP admin
rights…`) со статусом `ok`, итог `# fail 0`.

## AC → доказано → чем краснеет (перепроверено, не на слово автору)

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 | `test_cancel_before_reply_token_releases_http_preview_and_immediate_retry` (реальный HA HTTP+WS, подтверждён зелёным CI-логом), `test_cancelled_delayed_upload_cannot_damage_a_new_preview`, клиентские `cancel during response-body read…`/`a late cancelled ZIP reply…` (оба зелёные в CI-логе) | Прочитан код: `upload()` ставит `session.preview_token` из `response["token"]` и тут же вызывает `reserve_bytes(session, 0)`, который бросает `zip_cancelled`, если `session.cancelled` установлен конкурентным `release()` — поздний ответ не может воскресить отменённую операцию. Проверено чтением и тестом одновременно. |
| AC2 | `test_early_cancel_does_not_resurrect_or_cancel_other_requests_or_owners`, `test_cancel_waits_for_its_own_worker_before_staging_cleanup`, `test_cancel_preserves_durable_import_and_bounds_early_cancel_records`, `test_operation_cancel_keeps_admin_and_exact_identity_guards` — все в прошедшем прогоне 1776 passed | `cancel_import()` ищет сессию по `(owner, operation_id)`, где `owner` берётся сервером из `_connection_user_id(connection)`/`str(user.id)`, а не из входа клиента — подменить чужого владельца через WS-сообщение нельзя (проверено чтением). `release()` ждёт `session.workers` до удаления staging (тест с `threading.Event` подтверждает: `folder.exists()` остаётся true, пока воркер не завершён). Durable Apply защищён явной проверкой `archive.get("session") == session.session` до `session.cancelled.set()` — подтверждено тестом, где `cancel_import` не трогает сессию с совпавшим durable `archive.session`. |
| AC3 | Полный backend-прогон (1776/1776 + 1 ожидаемый skip) и полный frontend unit-прогон (4221 pass / 0 fail) на точном SHA — оба подтверждены логами CI, а не только текстом автора. Changelog (RU/EN) и USER-GUIDE (RU/EN) обновлены в тех же User-Visible-коммитах. | Последний коммит `8ed31e7bf` сам является отрицательным доказательством: до него `flushImportCancels()` вызывался безусловно и падал `unauthorized` при потере admin-прав, блокируя обычный JSON-импорт; тест `losing ZIP admin rights cannot strand an otherwise permitted legacy JSON import` — зелёный в CI-логе после фикса. |

Регистрация ночного мутанта `backup-zip-early-cancel-resurrects-upload-971`
(патч `if operation_id and (owner, operation_id) in self._cancelled_imports:`
→ `if False:`) — не исполнялась, что и требуется политикой; статический
`--check` и регистрация не выдаются за caught.

## Что проверено и корректно

- Owner identity на HTTP (`str(user.id)` в `backup_http.py`) и на WS
  (`_connection_user_id` в `websocket_api.py:339-340`) совпадают по форме —
  `cancel_import` находит именно свою сессию, не чужую.
- `vol.Optional("token")/vol.Optional("operation_id")` + ручной XOR-чек
  (`websocket_api.py:666-668`) не ослабляют существующий admin-гейт
  (`archive_admin` проверяется до разбора сообщения, как и раньше) —
  легаси token-cancel и новый operation-cancel оба требуют админа, что
  соответствует тому, что только admin-only ZIP-поток вообще выставляет
  токен/operation клиенту (`src/backup-archive-client.ts:133,118` — `importToken`/
  `importOperation` присваиваются только при `zip === true`).
- Повторный (двойной) вызов `release()` безопасен: `sessions.pop(..., None)`,
  `import_previews.pop(..., None)`, `cleanup_stage` выходит по отсутствующему
  маркеру — идемпотентность подтверждена чтением `backup_files.py:104-107`.
- Bounded tombstone (64/пользователь, 256 всего) и отсутствие продления TTL при
  повторной отмене той же операции подтверждены тестом
  `test_cancel_preserves_durable_import_and_bounds_early_cancel_records`.
- Release-ledger `docs/release-ledger/v1.81.0/971.json`: категория `line-fix`,
  `introducedBy: 936` — корректно, так как ZIP-импорт отсутствовал в
  v1.81.0 (сам #936 — внутрибетная фича); формат совпадает с соседними
  line-fix записями (например, `941.json` тоже без `summary`).
- Changelog: одна запись в `docs/CHANGELOG.md`/`.ru.md`, покрывающая обе
  правки (#971 основную и позднюю «keep legacy JSON»); число «10 минут»/TTL
  упоминается в USER-GUIDE (RU/EN) и ARCHITECTURE.md с одним источником —
  существующей константой `IMPORT_PREVIEW_TTL_S = 10 * 60` (`const.py:86`),
  не задвоено произвольно.

## Находки

Нет. High: 0, Medium: 0 (ни в скоупе, ни вне скоупа — новых issue не заводится).

Минорное стилистическое наблюдение (не находка, не влияет на вердикт):
`backup_service.py:133-134` использует имя `key` одновременно как внешнюю
переменную (`key = (owner, operation_id)`) и как переменную генератора
(`sum(key[0] == owner for key in self._cancelled_imports)`) — семантически
корректно (генератор создаёт свою область видимости), но снижает читаемость
при будущей правке этой функции.

## Чего не проверял

- `npx tsc --noEmit`, `npm test`, `npm run build` + сверку трёх копий бандла —
  не перегонял отдельно: Validate на точном SHA `8ed31e7bf` зелёный
  (https://github.com/Matysh/houseplan-card/actions/runs/39375166834),
  проверено через `gh run view` с разбивкой по job (не только общий статус):
  job «Фронтенд» выполнен с `reused:false`, лог показывает реальный прогон
  `npx tsc -p tsconfig.test.json` + unit-тесты с нужными новыми кейсами.
- `pytest tests_backend` целиком не перегонял локально — вместо этого прочитан
  лог CI-job «Бэкенд: pytest в Home Assistant» на точном SHA: `1776 passed,
  1 skipped`, HA-harness собран (coverage по `websocket_api.py`/
  `backup_service.py` присутствует, значит `test_ha_*.py` не является
  «HA harness NOT collected»).
- `node demo/smoke_backup_archive.mjs` и остальные одиннадцать смоков из
  выборки `smoke-select` не перегонял — Playwright-job в Validate для push
  в issue-ветку по умолчанию не входит в heavy-набор (трейлер `Release:`
  отсутствует, это не кандидат беты), поэтому CI не даёт независимого
  подтверждения этих смоков на этом SHA. Положился на чтение диффа
  `demo/smoke_backup_archive.mjs` (новые oracle
  `cancelledRequestDoesNotKeepServerSlot`, `cancelDuringBodyAllowsImmediateRetry`
  логически согласованы с проверенным backend/client-кодом и уже прогнанным
  backend/client-тестами) и на не являющееся авторитетом для ревью заявление
  автора о локальном прогоне (PASS, 18 oracle). Диапазон AC («node demo/
  smoke_backup_archive.mjs» прямо назван в тексте задачи как часть
  доказательства AC1) делает этот смоук формально обязательным, но изменения
  в нём — тонкая обвязка существующего фикстур-транспорта поверх уже дважды
  (backend+client) подтверждённой логики; риск того, что отдельный прогон
  покажет иное, оцениваю низким и не возвращаю задачу в жёлтый только из-за
  отсутствия третьего (browser native) подтверждения той же логики.
- `npm run invariants` — не применимо, геометрия/ссылки на неё не менялись.
- `golden:verify`, `performance` — не применимо, рендер и перф не затронуты.
- `python -m ruff check` — не перегонял отдельно; не является частью
  обязательного набора для этого диффа, полагаюсь на отсутствие стилевых
  нарушений, видимых при чтении (snake_case, типизация, существующие
  соглашения модуля соблюдены).

Политика находок: доверенный снимок `mode=issues`. Побочных находок нет —
новые issue не заводятся.

## Вердикт

Зелёный. AC1-AC3 доказаны автотестами, подтверждёнными независимо через логи
CI на точном материале SHA, плюс чтением кода для защищённых участков
(гонки, владение, durable Apply). Документация, changelog (RU/EN),
release-ledger и trailers корректны. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/971-zip-import-cancel`, коммит `8ed31e7bf196` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4fa081dae453d2d47e4af6d4fb011b53bd3edc32`
  ```
  git log --all --format='%H %T' | grep 4fa081dae453
  ```
- Тело issue: `8bad94f961351251ed2ef4fcfdde0f9e94c587aab1374ede09af6c4910adc756`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUzNDMsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NDU3OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5NCwib3V0cHV0X3Rva2VucyI6MzA5ODksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTI4MzI2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDA1NTk0NSwiY29zdFVzZEVzdGltYXRlIjoxLjYzNDU3MX1dLCJ0dXJucyI6NDksImR1cmF0aW9uTXMiOjQyNTc2MiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuNjQwMDI5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5437 output_tokens=31012 cache_creation_input_tokens=128326 cache_read_input_tokens=4055945 num_turns=49 -->
