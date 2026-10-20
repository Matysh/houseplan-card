# CODE-REVIEW #971 · заход r2

Материал: `3f2a230ceece08fee2cdc1347ee5a7579ace835b` (рабочая копия уже на этом SHA).
Диапазон: `git log --oneline origin/dev..HEAD` = `d66941b7c` («cancel ZIP previews
before their response arrives»), `6011576b7` («keep legacy JSON available after
ZIP rights change»), `3f2a230ce` (docs: review document for #971, r1). Трек:
show. Блокирующих циклов израсходовано 0 из 2 (зелёный r1 бюджет не тратит, #227).

## Скоуп

Тот же скоуп, что в r1: регрессия к #936 (контракт отмены ZIP-предпросмотра,
п.6/8, AC9) — закрытие/отмена импорта ZIP не освобождала серверную сессию до
ответа на HTTP-запрос, повторная попытка получала `zip_busy` вплоть до TTL (10
минут). Файлы: `src/backup-archive-client.ts`,
`custom_components/houseplan/{backup_service,backup_http,websocket_api}.py`,
соответствующие тесты, демо-смоук, документация, release-ledger,
`scripts/mutation-registry.mjs`.

**Почему вообще есть r2, если r1 был зелёным.** После публикации зелёного
r1 (`8ed31e7bf196c7c6a542365e786d17af04e8db3f`, issue-комментарий
2026-10-20T06:09:21Z) `dev` продвинулся (слияние ТЗ #973 и записи STATUS.md).
Ветка `issue/971-zip-import-cancel` не сливалась чистым fast-forward, поэтому
по §2.10 слияние — это «другой код», и автор сделал `git rebase origin/dev`
силами task-branch (без force-push поверх опубликованной истории dev),
получив новый SHA `3f2a230ce` с вершиной — тем же самым опубликованным
документом `CODE-REVIEW-971-r1.md`. Первая попытка модельного ревью этого
нового SHA (run `39379925925`, 06:29) завершилась инфраструктурной ошибкой
(success без `structured_output`) — это не вердикт, цикл не израсходован.
Настоящий прогон — этот.

## Риск по изменённым участкам (#707) и маршрут (#726)

Помеченный класс — тот же, что в r1: хвост WS-ветвления в
`websocket_api.py:650-651,666-671` (`vol.Optional("token")`/`vol.Optional("operation_id")`,
XOR-проверка, вызов `service.cancel_import`). Построчно сверено с текущим файлом
(см. «Делта к r1» ниже) — номера строк и содержимое не сдвинулись и не
изменились относительно r1. Поведение и совместимость зафиксированы в теле
issue («Техническое решение»: opaque id известен клиенту до ответа, WS-отмена
привязана к HA-пользователю, старые клиенты сохраняют token-flow) и
задокументированы в `docs/ARCHITECTURE.md` («ZIP import cancellation (#971)»),
`docs/CONFIG-COMPATIBILITY.md` и `docs/DEVELOPMENT.md` («Cancellation
regression (#971)») — проверено чтением текущих версий этих файлов, не по
памяти о r1.

- **complexity** — не изменилась: тот же один новый tombstone-словарь, тот же
  набор `session.workers`, тот же XOR-переключатель в WS. 3/10 соответствует.
- **surfaces** — одна поверхность: мастер ZIP-импорта и его серверная сессия.
- **migration** — нет миграции конфига; `operation_id`/`X-Houseplan-Operation` —
  транспортное поле, не персистентное (`CONFIG-COMPATIBILITY.md` подтверждает).
- **ux-contract** — восстанавливает уже утверждённый контракт #936, новый
  UX-текст в USER-GUIDE — уточнение того же контракта (не TTL, а немедленный
  повтор), не новый.
- **perf-touch** — не затронуто.
- **undocumented** — поведение названо в issue и в трёх канонических файлах.

Route: **fix** (реклассификация не требуется) — все шесть критериев §5
пройдены, так же как в r1.

## Делта к r1 (§2.10) — метод проверки

Старые объекты r1-материала (`8ed31e7bf196c7c6a542365e786d17af04e8db3f`,
doc-tip `74d8ebba17686c62f071ad06b63cfd46281eb4df`) не резолвятся в этой
рабочей копии (`git cat-file -t` → `fatal: could not get object info`) —
по §2.10 это обычное дело, не находка: материал ищется по дереву/блобу, а не
по недоступному commit-object.

Поскольку рёбейз на ушедший вперёд `dev` — это не локальная дельта по
определению REVIEWER.md «Повторный раунд», разбор сделан **полным**, не
дельта-only:

1. Построчно перечитан весь `git diff origin/dev...HEAD` по каждому
   изменённому файлу (`backup_service.py`, `backup_http.py`,
   `websocket_api.py`, `backup-archive-client.ts`,
   `test/backup-archive-client.test.mjs`, `tests_backend/test_ha_backup_archive.py`,
   `demo/smoke_backup_archive.mjs`, `scripts/mutation-registry.mjs`,
   `docs/release-ledger/v1.81.0/971.json`, все затронутые `docs/*.md`). Логика
   гонки (`reserve`/`upload`/`release`/`cancel_import`, `session.cancelled`,
   `session.workers`, `self._cancelled_imports`, XOR в WS, idempotent
   `cleanup_stage`) и содержимое новых тестов текстуально совпадают с тем, что
   описано и процитировано в `CODE-REVIEW-971-r1.md` — имена функций, номера
   строк, тела тестов, тексты AC-таблицы идентичны.
2. Независимое машинное подтверждение: Validate на точном SHA `3f2a230ce`
   (`gh run view 39379349718` → `conclusion: success`, `headSha` совпадает).
   Job «Фронтенд: типы, юниты, мутанты, синхрон бандла» в своём логе печатает
   `{"reused":true,...,"sourceSha":"8ed31e7bf196c7c6a542365e786d17af04e8db3f"}` —
   это автоматический tree-hash dedup конвейера, который сам подтвердил байтовую
   идентичность отслеживаемого дерева r2 дереву r1, независимо от моего чтения
   диффа.
3. При этом job «Бэкенд: pytest в Home Assistant» в своём логе **не содержит**
   метки reuse — выполнен заново на новом SHA и дал `1776 passed, 1 skipped in
   88.07s` (проверено `gh run view --job 118485190345 --log`). Это свежее,
   не унаследованное исполнение HA-гарнизона на материале r2.
4. Тот же фронтенд-job, несмотря на `reused:true` для бандла, напечатал живой
   вывод юнит-тестов с актуальными таймстемпами на ~3.5 минуты рантайма,
   включая все четыре теста #971 (`ok 39-42`: «cancel during response-body
   read…», «a late cancelled ZIP reply…», «lost cancel ACK…», «losing ZIP
   admin rights…») и итог `# pass 4221 / # fail 0` — юнит-тесты выполнены на
   этом прогоне, а не скопированы из r1.

Итог: дельта между материалом r1 и r2 в продуктовом/тестовом/документационном
коде — пустая. Единственное отличие — форма git-истории (рёбейз убрал merge
commit, конфликт двух абзацев в `STATUS.md` с параллельно слитым #973
разрешён сохранением обоих) и разбиение на два логических коммита вместо
одного. Разбор при этом остался полным по названной причине (рёбейз на
ушедший вперёд `dev`), а не сокращённым до дельты.

## AC → доказано → чем краснеет (переподтверждено на материале r2)

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 | `test_cancel_before_reply_token_releases_http_preview_and_immediate_retry`, `test_cancelled_delayed_upload_cannot_damage_a_new_preview` (HA pytest, свежий прогон на `3f2a230ce`, 1776 passed/1 skipped — не reused), клиентские `cancel during response-body read…`/`a late cancelled ZIP reply…` (`ok 39`, `ok 40` в логе фронтенд-job этого прогона) | Прочитан код: `upload()` ставит `session.preview_token` из `response["token"]` и тут же вызывает `reserve_bytes(session, 0)` (`backup_service.py`), который бросает `zip_cancelled`, если конкурентный `release()` уже поставил `session.cancelled` — поздний ответ не воскрешает отменённую операцию. Строки и логика идентичны r1. |
| AC2 | `test_early_cancel_does_not_resurrect_or_cancel_other_requests_or_owners`, `test_cancel_waits_for_its_own_worker_before_staging_cleanup`, `test_cancel_preserves_durable_import_and_bounds_early_cancel_records`, `test_operation_cancel_keeps_admin_and_exact_identity_guards` — все в свежем прогоне 1776 passed этого раунда | `cancel_import()` ищет сессию по `(owner, operation_id)`, где `owner` — серверный `_connection_user_id(connection)`/`str(user.id)`, не вход клиента — подменить чужого владельца нельзя (прочитано в текущем `websocket_api.py:669`/`backup_http.py:43`). `release()` ждёт `session.workers` до удаления staging. Durable Apply защищён `archive.get("session") == session.session` до `session.cancelled.set()`. |
| AC3 | Validate-прогон на `3f2a230ce`: backend 1776/1 skip (свежий), frontend 4221 pass/0 fail (живой вывод в логе, включая 4 новых client-теста). Changelog (RU/EN) и USER-GUIDE (RU/EN) обновлены в тех же User-Visible-коммитах (`6011576b7`, `d66941b7c`) | `losing ZIP admin rights cannot strand an otherwise permitted legacy JSON import` (`ok 42`) — отрицательное доказательство: до фикса `flushImportCancels()` вызывался безусловно и падал `unauthorized` при потере admin-прав, блокируя обычный JSON-импорт. |

Регистрация ночного мутанта `backup-zip-early-cancel-resurrects-upload-971`
(`scripts/mutation-registry.mjs`, патч `if operation_id and (owner, operation_id)
in self._cancelled_imports:` → `if False:`) — не исполнялась в этом прогоне,
что и требуется политикой вне ночного workflow; статический `--check` и
регистрация не выдаются за caught. Файл не менялся с r1.

## Закрытие раунда r1

r1 не оставил находок — таблица пуста по построению (High 0, Medium 0,
`docs/reviews/CODE-REVIEW-971-r1.md`, раздел «Находки»: «Нет»). Единственное
нестрогое замечание r1 («минорное стилистическое наблюдение», не находка, не
влияет на вердикт) — повторное использование имени `key` в `backup_service.py`
как внешней переменной и как переменной генератора — по-прежнему присутствует
в коде байт-в-байт (тот же файл, та же функция `cancel_import`/проверка
лимита), не является находкой и не образует цикл.

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| — (находок не было) | — | — |

## Унаследовано из r1

Без повторного самостоятельного исполнения в этом раунде (материал не
изменился для этих путей, см. «Делта к r1»):

- `python -m ruff check custom_components/houseplan tests_backend/test_ha_backup_archive.py`
  — PASS на `8ed31e7bf` (авторский гейт-лог, issue-комментарий 05:52); код
  этих файлов не менялся с r1.
- `node demo/smoke_backup_archive.mjs` (18 oracle) и остальные одиннадцать
  смоков из `smoke-select` — PASS на `8ed31e7bf` (авторский лог); файл
  `demo/smoke_backup_archive.mjs` не менялся между r1 и r2 (входит в пустую
  дельту, подтверждённую построчным чтением выше).
- Полный разбор гонки/владения/durable-Apply в прозе r1 — перечитан мной
  заново в этом раунде (не слепое наследование, см. «Делта к r1» п.1), вывод
  совпадает.
- Release-ledger `docs/release-ledger/v1.81.0/971.json` (`line-fix`,
  `introducedBy: 936`) и его обоснование относительно `v1.81.0` — переподтверждено
  мной чтением файла в этом раунде, вывод r1 корректен: ZIP-импорт отсутствовал
  в v1.81.0 (сам #936 — внутрибетная фича 1.82.0), значит правка не входит в
  пользовательский milestone релиза отдельной строкой.

## Что проверено и корректно

- Owner identity на HTTP (`str(user.id)`) и на WS (`_connection_user_id`)
  совпадают по форме — `cancel_import` находит именно свою сессию.
- `vol.Optional("token")`/`vol.Optional("operation_id")` + ручной XOR-чек
  (`websocket_api.py:666-668`, номера строк проверены на текущем файле) не
  ослабляют `archive_admin`-гейт — он проверяется раньше разбора сообщения.
- Повторный вызов `release()` безопасен: `sessions.pop(..., None)`,
  `import_previews.pop(..., None)`, `cleanup_stage` выходит по отсутствующему
  маркеру.
- Bounded tombstone (64/пользователь, 256 всего), отсутствие продления TTL при
  повторной отмене — подтверждено тестом, свежий прогон этого раунда зелёный.
- Changelog: одна запись в `docs/CHANGELOG.md`/`.ru.md` на оба User-Visible-коммита
  (`d66941b7c`, `6011576b7`); USER-GUIDE RU/EN обновлены тем же смыслом.
  Число «10 минут»/TTL видно в USER-GUIDE (RU/EN), ARCHITECTURE.md,
  DEVELOPMENT.md — один источник, существующая константа `IMPORT_PREVIEW_TTL_S`
  (не менялась в этом диффе), не задвоено произвольно.
- Трейлеры: все три коммита диапазона несут `Issue: #971`; `d66941b7c` и
  `6011576b7` — `User-Visible: yes` с правками в оба changelog в том же
  коммите каждый; `3f2a230ce` (документ ревью) — `User-Visible: no`, без
  правок в changelog, что корректно для docs-коммита.

## Чего не проверял

- `npx tsc --noEmit`, полный `npm test`, `npm run build` + сверку трёх копий
  бандла локально — не перегонял: Validate на точном SHA `3f2a230ce` зелёный
  (https://github.com/Matysh/houseplan-card/actions/runs/39379349718),
  независимо проверено через `gh run view`/`gh api .../jobs` с разбивкой по
  job: «Бэкенд» выполнен без reuse-метки (1776 passed/1 skipped за 88 c),
  «Фронтенд» напечатал живой юнит-вывод (4221 pass/0 fail, включая 4 теста
  #971) при переиспользованном (по дереву) бандле — переиспользование
  бандла, не тестов, подтверждено логом, а не декларацией.
- `pytest tests_backend` целиком локально не перегонял — прочитан лог CI-job
  «Бэкенд: pytest в Home Assistant» на точном SHA: `1776 passed, 1 skipped`,
  без reuse-пометки, coverage по `websocket_api.py`/`backup_service.py`
  присутствует — не «HA harness NOT collected».
- `node demo/smoke_backup_archive.mjs` и остальные смоки из `smoke-select` —
  не перегонял в этом раунде; файл демо-смоука входит в подтверждённую выше
  пустую дельту к r1, где он уже был прочитан и (по утверждению автора,
  проверенному логом CI job «Фронтенд» r1, который независимо подтверждён
  r1-ревьюером) PASS. Playwright-job в Validate для push в issue-ветку по
  умолчанию не входит (трейлер `Release:` отсутствует) — CI не даёт
  независимого подтверждения этих смоков на новом SHA, риск по-прежнему
  оцениваю низким по тем же причинам, что и r1 (тонкая обвязка существующего
  fixture-транспорта поверх дважды подтверждённой логики).
- `python -m ruff check` — не перегонял отдельно в этом раунде; инструменты и
  код, которые он проверяет, не менялись с r1, где PASS зафиксирован авторским
  логом.
- `npm run invariants`, `golden:verify`, `performance` — не применимо:
  геометрия, рендер и перф не затронуты.

## Политика находок

Доверенный снимок: `mode=issues`. Побочных находок нет — новые issue не
заводятся.

## Вердикт

Зелёный. Дельта к r1 — пустая во всех продуктовых/тестовых/документационных
путях (подтверждено построчным чтением диффа, независимым `git diff --check`
через CI tree-dedup и свежим HA-прогоном на новом SHA); единственное отличие —
форма git-истории после рёбейза на ушедший вперёд `dev`, что и потребовало
новый раунд по §2.10, но не новый код. AC1-AC3 доказаны автотестами,
подтверждёнными независимо через логи CI на точном материале `3f2a230ce`
(backend — свежим прогоном, frontend — живым выводом юнит-тестов), плюс
построчным чтением для защищённых участков (гонки, владение, durable Apply).
Документация, changelog (RU/EN), release-ledger и трейлеры корректны. Находок
нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/971-zip-import-cancel`, коммит `3f2a230ceece` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `83ca05aea942912ae1b4d3d3bd19b3b033c39691`
  ```
  git log --all --format='%H %T' | grep 83ca05aea942
  ```
- Тело issue: `8bad94f961351251ed2ef4fcfdde0f9e94c587aab1374ede09af6c4910adc756`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUzNDAsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NDM1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6MzE2NTcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTExODM2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjIzNjA3NSwiY29zdFVzZEVzdGltYXRlIjoxLjIxMTIzMjk5OTk5OTk5OTh9XSwidHVybnMiOjQxLCJkdXJhdGlvbk1zIjozODkxOTAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjIxNjY2Nzk5OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5392 output_tokens=31676 cache_creation_input_tokens=111836 cache_read_input_tokens=2236075 num_turns=41 -->
