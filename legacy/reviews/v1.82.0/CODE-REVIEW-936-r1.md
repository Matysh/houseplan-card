# CODE-REVIEW-936-r1

Issue: #936 «Полный бэкап: ZIP с изображениями и сохранённым снимком Zigbee-связей»
Этап: code · Заход r1 · Трек: ask · Блокирующих циклов использовано 0/4
Материал: `792c70b204120c9b14c50cf75f4c63cb6668383d` (origin/dev..HEAD = 026b71d3 feat + 792c70b2 fix)
Маршрут вердикта: `route: fix` (задан пакетом ревью, track:ask).
Побочные находки: `mode: issues` (доверенный снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`) — побочных Medium вне скоупа не найдено, новых issue не заводится.

## Скоуп

ТЗ r1 (принято SPEC-REVIEW-936-r1, High0/Medium0) требует: админ-only портативный ZIP-бэкап (конфиг+layout+используемые изображения трёх классов+сохранённый Z2M-снимок), явное согласие на неполную копию (Q1=1б), admin-only доступ к ZIP и его восстановлению (Q2=2а), сохранение старого JSON-пути для обычных редакторов и экспорта пространства/«только планировка», durable atomic apply/undo, закрытый bounded ZIP-парсер, неизменный Help-контракт. 14 AC, релиз — major относительно v1.81.0, milestone 1.82.

Дифф: 43 файла, +3888/-94. Новые backend-модули `backup_archive.py`, `backup_files.py`, `backup_http.py`, `backup_service.py`, `backup_transaction.py`; точечные правки `import_export.py`, `store.py`, `websocket_api.py`, `zigbee_topology.py`, `__init__.py`, `const.py`, `decor_assets.py`; frontend `backup-archive-client.ts`/`backup-archive-lazy.ts`, правки `general-settings-dialog.ts`/`houseplan-card.ts`/`houseplan-editor-runtime.ts`; i18n (4 языка); тесты `test_ha_backup_archive.py` (749 строк), `backup-archive-client.test.mjs`, `demo/smoke_backup_archive.mjs`; документация (USER-GUIDE RU/EN, ARCHITECTURE, CONFIG-COMPATIBILITY, DECOR-EDITOR, DEVELOPMENT, STATUS, оба CHANGELOG, release-ledger).

## Риск по изменённым участкам (#707) — сверка покрытия AC

| Класс риска | Представительные участки | AC, где зафиксировано поведение |
|---|---|---|
| geometry | `backup_transaction.py:15-17,58-59` — `canonicalize_config_geometry`/`layout_geometry` | AC2 (трансформации/геометрия сохраняются, новой геометрии не вводится — подтверждено чтением: функции переиспользованы из существующего `coordinate_canonicalization`, не изменены) |
| migration | `import_export.py:1748-1815` и далее (+19/-6 всего) | AC14 (unknown-field/legacy JSON round-trip) — изменение сводится к необязательному параметру `portable_content: frozenset = frozenset()`, при пустом множестве логика математически эквивалентна старой; старые вызовы (`http_api.py`) его не передают |
| devices | `backup_http.py:21` `archive_admin`, `websocket_api.py` (7 новых/изменённых admin-gated точек входа) | AC1, AC5 (auth-матрица, admin-only ZIP, JSON для обычных редакторов) |
| ux | 24 новых ключа `backup.*` в 4 языках | AC13 (i18n parity) — см. находку L1 ниже о расхождении буквальных имён ключей со списком в теле ТЗ |

Все четыре класса покрыты именованным AC; `route: reclassify` не требуется (это и не применимо — трек `ask`, `route` фиксирован пакетом как `fix`).

## Как проверялось

Дешёвые гейты подтверждены внешним пакетом ревью: Validate `792c70b2` → success (https://github.com/Matysh/houseplan-card/actions/runs/39105249325), поэтому `tsc`, `npm test`, `npm run build`+bundle-policy не перегонялись повторно. Разобрал breakdown этого прогона: `Бэкенд: pytest`, `Мутанты по диффу`, `HACS`, `Hassfest`, `Геометрия TS/Python parity`, `Бандл dev для стенда` — все `skipped` по условию `needs.reuse.outputs.* == 'true'`. Это не пропуск проверки: второй коммит `792c70b2` (голова материала) меняет только `src/backup-archive-client.ts`/тесты/доки, бэкенд и геометрия с предыдущего (уже провалидированного) коммита `026b71d3` не менялись — reuse корректно переиспользует их прежний зелёный результат на неизменном поддереве. Golden и смоки (3 шарда) и перф-смок в этом прогоне реально `success`, не reuse.

Своей работой выполнил (без мутации продукта):
- Полное построчное чтение: `backup_archive.py`, `backup_files.py`, `backup_service.py`, `backup_http.py`, `backup_transaction.py`, диффов `websocket_api.py`, `zigbee_topology.py`, `store.py`, `__init__.py`, `import_export.py`, `const.py`, `decor_assets.py`, `bundle-budget.mjs`, `monolith-baseline.json`, `mutation-registry.mjs`, всех изменённых docs.
- `node scripts/mutation-gate.mjs --check` — статический прогон (не исполнение): `static-readiness: definitions=1663 ... execution=0 caught=unknown (nightly only)`, 4 новых witness для #936 (`backup-zip-opens-to-ordinary-editors`, `backup-zip-overwrites-changed-mesh-generation`, `backup-zip-undo-forgets-previous-saved-mesh`, `backup-zip-failed-publication-keeps-owned-hardlinks`) — все `ok` (их `find`-паттерны реально присутствуют в текущем коде).
- `node scripts/process-gate.mjs --issues --report` → «гейт пройден, предупреждений 0», 2 коммита, оба с `Issue:`/`User-Visible:` трейлерами.
- Прямое чтение `tests_backend/test_ha_backup_archive.py` (сэмпл ключевых негативных кейсов: `test_malformed_archive_matrix_never_changes_public_data`, `test_archive_hostile_names_are_rejected_before_any_target_write`, `test_full_portable_export_is_zip_not_reference_only_json` — именно заявленный «обычный red»).
- Сверка i18n: `node -e` по всем 4 `src/i18n/tools/*.json` — 24 ключа `backup.*`, идентичный набор во всех языках.
- Сверка бюджета: `scripts/bundle-budget.mjs` (`LAZY_EDITOR_GZIP_CEILING = 273_105`) и `scripts/monolith-baseline.json` (`bundleBytes: 3042858`) — оба значения буквально совпадают с одобрением владельца (issuecomment-6246498820).
- 5 параллельных агентских разборов (каждый — независимое построчное чтение + сверка с тестами, без исполнения pytest/мутаций): ZIP-парсер/security (AC11), durability/транзакции (AC9/AC10), admin-only auth (AC1/AC5), Zigbee-снимок (AC6/AC7/AC14), frontend/i18n/бюджет (AC4/AC13), тестовое покрытие и legacy-совместимость (AC12/AC14 + честность таблицы автора).

## Находки

Находок High или Medium — **0**. Две Low-находки, обе сняты ревьюером (не требуют цикла):

**L1 — буквальные имена части i18n-ключей отличаются от списка в теле ТЗ.** ТЗ перечисляет `backup.zip_admin_only`, `backup.zip_missing_reason`, `backup.zip_external_dependency`, `backup.zip_limit`, `backup.zip_invalid`, `backup.zip_conflict`. Реализация использует `backup.error.zip_admin_only`/`zip_limit`/`zip_invalid` (префикс `backup.error.*`), `zip_collision` вместо `zip_conflict`, `zip_missing_count`+`zip_reason.{missing,external,invalid,changed}` вместо одного `zip_missing_reason`. Снято: префикс `backup.error.<code>` — существующая до #936 конвенция всего error-code-реестра (`const.py` ERROR_CODES, закреплено тестом `test_issue_42_every_emitted_code_is_registered_and_localized`, который требует `backup.error.{code}` для каждого кода из `ERROR_CODES`, включая новые `zip_*`). Имя i18n-ключа — внутренний идентификатор, не видимый пользователю; видим только переведённый текст, который присутствует и параллелен во всех 4 языках (проверено построчно — 24/24 ключа идентичны в ru/en/de/fr, включая `zip_reason.external` — семантический эквивалент `zip_external_dependency`). Подпадает под явную техническую свободу ТЗ: «точные внутренние методы/API... автор/ревьюер вправе улучшить без изменения пользовательского контракта». Пользовательский контракт (сам текст, его наличие на всех языках, маппинг на код ошибки) не нарушен.

**L2 — нет отдельной кнопки «Вернуться» рядом со «Скачать неполную копию».** ТЗ п.5 называет текст, «Вернуться» и отдельную кнопку «Скачать неполную копию». Реализация: общий `Отмена` (закрывает диалог) + один `confirm`-button, который после первого клика (подготовка, без скачивания) меняет подпись на «Скачать неполную копию» (`houseplan-editor-runtime.ts:9051-9053`, подтверждено `backup-archive-client.test.mjs` — «incomplete ZIP needs a second distinctly labelled action»). Автоматического скачивания нет, список недостачи показан (`renderSummary`), согласие — отдельное действие. Снято: ключевое требование AC4 («до отдельного согласия ZIP не скачан», список виден) выполнено функционально; «Вернуться» и «Отмена» эквивалентны по следствию (не скачивать, вернуться к выбору), различие — только в точной подписи кнопки, не в поведении. Не дефект, видимый пользователем как потеря функциональности.

Обе находки — Low, сняты с записью выше; AC4 и AC13 оцениваются как выполненные.

## Что проверено и корректно

- **AC1/AC5 (admin-only)**: все новые HTTP/WS точки входа (`backup_http.py` оба view, `ws_export_create` archive-ветка, `ws_backup_cancel`, `ws_import_revalidate` archive-ветка, `apply_archive`, `undo_archive_locked`) используют `archive_admin()` = `is_admin AND may_write`, перепроверяемый до и после каждого yield-поинта (после upload, после хэширования, перед durable commit). ZIP-байты с `Content-Type: application/json` не обходят проверку — маршрутизация идёт по эндпойнту/WS-флагу, а не по заявленному MIME; легаси JSON-предпросмотр падает на попытке распарсить бинарные байты как JSON. Обычный редактор получает прежний полный JSON без снимка Zigbee (ветка без `archive` не трогает `zigbee_coordinator`). Токен — `secrets.token_urlsafe(32)`, owner-bound, TTL 10 мин (`IMPORT_PREVIEW_TTL_S`), выдача файла — `POST` на серверный путь, не публичный GET-URL.
- **AC11 (защита ZIP)**: нет `extractall`; закрытый allow-list имён записей (`manifest.json`/`document.json`/опционально `zigbee.json`/`images/<sha256>.ext`); явный запрет абсолютных путей, `..`-сегментов (проверка по каждому сегменту, включая `a/../../b`), backslash/non-ASCII через строгий regex `[A-Za-z0-9./_-]{1,96}`, шифрования (`flag_bits & 1`), symlink/special (`external_attr` S_IFMT-проверка); дубликаты имён и незаявленные/лишние записи отклоняются точным сравнением множеств. Путь назначения на диске всегда server-chosen (`staging/blob-{index}`, затем `PLANS_DIR/FILES_DIR/ASSETS_DIR` по распарсенному контенту, не по имени записи в архиве). CRC проверяется встроенным `zipfile` при полном чтении потока, плюс явный SHA-256 на каждом уровне (ZIP-запись → staged файл → итоговый файл). Лимиты (2 GiB/1600 записей/2 MiB manifest) проверяются ДО конструирования `ZipFile` (ручной разбор EOCD по хвосту файла) И во время потокового чтения (накопительный счётчик по факту прочитанных байт, не только по заголовку `info.file_size`) — защита от decompression-bomb реальна, не заявлена. 64 KiB чанки подтверждены (`CHUNK=64*1024`), весь ZIP в память не грузится. Staging/reuse не следуют symlink (`O_NOFOLLOW` на каждом компоненте пути, `os.link(..., follow_symlinks=False)`, inode-идентичность при `FileExistsError`). Все 12 вариантов `malformed_archive_matrix` (future/unknown-field/digest/duplicate/extra/symlink/encrypted/unsafe-image/crc/deflate/count/expanded) — реальные порченые байты, явный `assert` на неизменность публичных файлов до/после.
- **AC9/AC10 (durability apply/undo)**: HTTP-ответ/WS-событие отправляются строго после `_commit`/durable intent; pending-намерение (`OPTIMIZE_PENDING`) пишется до видимой мутации и докатывается при старте (`async_resolve_pending_pair` до любых других writer'ов); публикация файлов — `os.link`+`fsync` родительского dir-fd с идемпотентной inode-проверкой (не перезаписывает чужой файл); откат (`rollback_files`) снимает только proven-owned hardlink. Undo-ветка вообще не трогает файловую систему (`action == "cache"`). 4-параметрический тест `apply_target_write_failure` (config/layout/cache/files) реально монкипатчит точку отказа и проверяет откат всех четырёх поверхностей; `restart_finishes_interrupted` реально отменяет задачу и проверяет докат после `async_reload`.
- **AC6/AC7 (Zigbee-снимок)**: экспортируются только `{"map","obtained_at"}` (явный запрет ключа `"transaction"`); restore полностью заменяет кеш (не merge), пустая секция → пустой кеш; OFF в целевом конфиге дважды принудительно обнуляет топики; cache-generation fencing (`_backup_pending`/`_backup_ready`) блокирует новый scan во время транзакции и гарантирует, что поздний MQTT-callback после `finish_backup_transaction` не найдёт себя в пересозданном `_jobs` и тихо выйдет. Старый JSON-путь (`"archive" not in candidate`) не подключается к новому snapshot-контракту.
- **AC14 (legacy/migration)**: единственное изменение `import_export.py` — необязательный параметр `portable_content: frozenset = frozenset()`, при значении по умолчанию логика byte-for-byte эквивалентна дособытийной; старые вызовы (`http_api.py`) его не передают. `future_936`-поле переживает полный ZIP round-trip (тест AC12/14 на строке 591/603). Help/support-путь (`support_package.py` и соседние support-модули) не затронут диффом вовсе (0 изменённых строк), что структурно гарантирует неизменность wire-контракта Help, подтверждено дополнительно тестом.
- **Бюджет**: `scripts/bundle-budget.mjs` → `LAZY_EDITOR_GZIP_CEILING = 273_105`, `scripts/monolith-baseline.json` → `bundleBytes: 3042858` — буквально совпадают с одобрением владельца; обе полосы (`BUNDLE_BYTES_BAND`, `LAZY_GRAPH_CEILING_BAND`) остались `2_000`; `INITIAL_VIEW_GZIP_CEILING` диффом не тронут (новый код не в eager-bundle, подтверждено структурным тестом `editor-dialog-styles.test.mjs` через граф статических/динамических рёбер).
- **Документация**: CHANGELOG (оба языка, в том же коммите, `User-Visible: yes`), USER-GUIDE.ru.md/.md, ARCHITECTURE, CONFIG-COMPATIBILITY, DECOR-EDITOR §7, DEVELOPMENT, STATUS, release-ledger `v1.81.0/936.json` (`major`, обоснование относительно предыдущего stable, milestone 1.82) — взаимно согласованы, числа (2 GiB/1600/10 минут) не расходятся между документами.
- **Ledger**: классификация `major` обоснована («new user capability, not internal-cycle polish» относительно v1.81.0) — соответствует характеру задачи, не внутрибетный фикс.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`/`npm test`/`npm run build`+bundle-policy — дешёвые гейты подтверждены зелёным Validate на точном SHA материала (см. «Как проверялось»); реального расхождения с этим прогоном не искал сверх разбора reuse/skip-причин.
- Не исполнял pytest/мутации с реальным сбоем (это запрещённый мутационный прогон вне ночного workflow) — для защитных AC опирался на: (а) статический `--check` новых witness'ов (все 4 — `ok`), (б) прямое построчное чтение тел тестов с подтверждением, что они бьют по реальному продукт-коду реальными хостильными байтами/сбоями ввода-вывода, а не тривиальными заглушками.
- Не запускал `demo/smoke_backup_archive.mjs`/`node --test test/backup-archive-client.test.mjs`/`pytest tests_backend` сам — автор заявил их прогон с результатами (120/120 смоков, 1649 passed/1 skipped, 12 passed client) на материале точного SHA; независимого повторного прогона не делал (полное Validate на этом SHA уже success).
- Не проверял реальный live HA/MQTT (ни автор, ни я — HA harness использует synthetic/mocked MQTT boundary; это честно отражено в документе автора и в DEVELOPMENT.md).
- Не проверял golden/визуальные baseline отдельно — изменение не трогает plan-render путь (`ci:golden` не требовался), в полном Validate golden прошёл как часть общего набора (success), отдельно не пересматривал кадры.
- Не проверял производительность под реальной файловой нагрузкой (десятки/сотни изображений) вживую — только по коду (executor jobs, 64 KiB чанки, heartbeat) и по тесту `test_large_export_yields_ha_loop_and_stream_caps_precede_allocation`, прочитанному, но не исполненному.
- Не нашёл отдельного (вне AC12-теста) unit-теста именно на unknown-field для *легаси* JSON-пути без архива; сочтено нерелевантным, так как сам диф для этого пути — доказуемо нейтральный default-параметр (см. AC14 выше, «проверено чтением, не исполнением»).

## Вердикт

Зелёный. High 0, Medium 0. AC1–AC14 покрыты автотестами с валидным «чем краснеет» (включая 4 новых зарегистрированных witness для AC1/AC7/AC9/AC10, не исполнявшихся — статический `--check` прошёл) либо разобраны по коду лично с записью «проверено чтением, не исполнением» (AC14 legacy-путь). Все четыре названных класса риска (geometry/migration/devices/ux) покрыты именованным AC. Побочных находок вне скоупа нет, новый issue не заводится.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/936-portable-full-backup`, коммит `792c70b20412` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a5275fbf99413d12f5d103fd4418573b7e57241d`
  ```
  git log --all --format='%H %T' | grep a5275fbf9941
  ```
- Тело issue: `a134bf3f5b801f3617f7b32eb104a730f7a38060b42cdf13022d1058c752e428`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjU0MDQsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NDg0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozNDQsIm91dHB1dF90b2tlbnMiOjE1OTQzMiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo2NzQzOTgsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMzYwMDY3MiwiY29zdFVzZEVzdGltYXRlIjo2LjMyODY2OTg5OTk5OTk5OTV9XSwidHVybnMiOjczLCJkdXJhdGlvbk1zIjo1OTA2MDIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjo2LjMzNDE1MzkwMDAwMDAwMDQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5748 output_tokens=159448 cache_creation_input_tokens=674398 cache_read_input_tokens=13600672 num_turns=73 -->
