# CODE-REVIEW-529-r1

**Issue:** [#529](https://github.com/Matysh/houseplan-card/issues/529) — «Тупик "conflicting wall identifiers": план правится только после ручной чистки»
**Материал:** `85e5d61fb18360a3159000a5f971f62c239d11c7` (два коммита поверх `b736878c`: `49912ac9` — фикс, `85e5d61f` — отпечаток скриншотов)
**ТЗ:** зелёное на r2 (`docs/reviews/SPEC-REVIEW-529-r2.md`), Medium r1 закрыт до кода
**Заход:** r1 · блокирующих циклов израсходовано 0/4

## Скоуп

Диапазон `origin/dev..HEAD`: `custom_components/houseplan/wall_segment_model.py`,
`custom_components/houseplan/validation.py`, `src/wall-segment-model.ts`,
`scripts/mutation-gate.mjs` (3 новых мутанта), тесты
(`tests_backend/test_wall_segment_model.py`, `tests_backend/test_ha_import_export.py`,
`test/wall-segment-model.test.mjs`), три копии бандла, оба чейнджлога,
`docs/CONFIG-COMPATIBILITY.md`, отпечаток скриншотов документации.

Первый код-ревью-раунд по этой задаче — раздел «объём по дельте» (§2.10) не
применяется, разбор полный.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Дешёвые гейты на этом SHA | ссылка на Validate | **success**, https://github.com/Matysh/houseplan-card/actions/runs/34578867814 (headSha = материал ревью) |
| typecheck + build | `npm run bundle:sync` (= `tsc --noEmit && rollup -c` + синхронизация трёх копий) | ok, `git status` после сборки — дерево чистое: локальная пересборка байт-в-байт совпала с закоммиченным дистом |
| unit | `npm test` | 2520 passed / 0 failed / 1 skip |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 0 новых `any` (10 добавленных строк в 1 файле) |
| `check-docs` | `node scripts/check-docs.mjs` | ok (7 файлов, 12 внешних ссылок) |
| выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 1 прямое совпадение — `demo/smoke_edit_walk.mjs` (символ `WallSegmentModelError`) |
| смок | `node demo/smoke_edit_walk.mjs` | ok, все 6 сценариев `true` |
| мутанты (патчи применимы) | `node scripts/mutation-gate.mjs --check` | ok по всем, включая 3 новых |
| мутанты (реально красят свидетеля) | логи джобов Validate `Мутанты по диффу (1/6, 5/6, 6/6)` на этом же SHA | все три новых мутанта: `ok … тест покраснел, как обязан` (см. таблицу AC7 ниже) |
| бэкенд | `python -m pytest tests_backend -q` | **не прогнан локально** — в песочнице нет `pytest`/`pytest_homeassistant_custom_component`. Подтверждено джобой Validate «Бэкенд: pytest в Home Assistant: success» на этом самом SHA |
| golden / полные смоки / perf-смок | — | джобы `skipped` в Validate (не heavy-событие: обычный push, не PR/release/nightly) — ожидаемо: diff не меняет видимый рендер, AC не требует golden |
| model invariants на конкретном конфиге | — | не прогонялся: нет спорного экспортированного конфига пользователя; геометрические свойства (сохранение id сегмента, `cm`, детерминированное разрешение коллизии id) проверены AC2/AC3 напрямую, а `npm test` уже гоняет инварианты на всех моделях проекта |
| `check-inputs`/классификация | job `Классификация изменённых файлов: success` | подтверждено CI |

## AC — таблица доказательств

| AC | Чем доказан | Чем красится (мутация/негативная проба) |
|---|---|---|
| AC1 (backend) | `test_empty_room_drafts_on_current_model_are_dropped_silently` — прогон в CI Validate (success) | косвенно AC7-мутант #1 (см. ниже) |
| AC2 (backend) | `test_room_drafts_on_current_model_convert_exactly_like_the_first_migration` — CI Validate | AC7-мутант `room-drafts-refuse-instead-of-heal` |
| AC3 (unit) | `test/wall-segment-model.test.mjs`, оба новых `#529`-теста — прогнаны локально (`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test`), 2/2 pass | AC7-мутант `room-drafts-mirror-still-throws` |
| AC4 (backend) | `test_outdated_client_is_recognised_by_the_carrier_not_by_the_model_number` (циклы по moduleversion 9 и 10) + неизменённый `test_stale_v9_room_draft_write_over_v10_is_rejected_before_schema` — CI Validate | AC7-мутант `outdated-client-detected-by-model-number` |
| AC5 (backend) | `test_legacy_left_in_storage_is_not_treated_as_a_stale_writer` (сторож не бросает) + правка теста инварианта схемы (пустой принимается, непустой отвергается) — CI Validate | обратная проба читается в самом тесте (`pytest.raises` на непустом) |
| AC5а (unit) | `#529: пустой room_drafts снимается молча` в `test/wall-segment-model.test.mjs` — прогнан локально, pass; прочтением подтверждено, что `commitWallSegmentModel` вызывается в `houseplan-editor-runtime.ts:2005,2030,2247,2405` и `draft-live-commit.ts:79,168` перед отправкой `config/set` | AC7-мутант `room-drafts-mirror-still-throws` |
| AC6 (backend) | `test_export_is_not_locked_by_legacy_room_drafts` — **не прогнан локально** (нет HA-окружения), подтверждён CI Validate («Бэкенд: pytest…: success» на этом SHA) + прочтением: `_create_export` (`import_export.py:507-511`) зовёт тот же `commit_wall_segment_model`, который после фикса не бросает | — (не защитный AC в терминах «отказ», а «перестал отказывать»; негативная проба избыточна) |
| AC7 (мутанты) | реестр `scripts/mutation-gate.mjs`, 3 определения | см. ниже — все три подтверждены логами CI на этом SHA |
| AC8 (ревью кода) | `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` (в коммите `User-Visible: yes`), `docs/CONFIG-COMPATIBILITY.md` — читал текст, совпадает с фактическим кодом | — |

### AC7 — три мутанта, конкретные строки логов Validate (SHA `85e5d61f`)

- `room-drafts-refuse-instead-of-heal` (возврат `raise` в питоновской миграции вместо тихого снятия/конвертации) → джоба «Мутанты по диффу (1/6)», `2026-09-11T08:26:31Z ok room-drafts-refuse-instead-of-heal: тест покраснел, как обязан`.
- `outdated-client-detected-by-model-number` (возврат сверки по `new_model < 10` вместо `not stored_drafts`) → джоба «(5/6)», `2026-09-11T08:26:29Z ok outdated-client-detected-by-model-number: тест покраснел, как обязан`.
- `room-drafts-mirror-still-throws` (TS-зеркало снова бросает вместо снятия ключа) → джоба «(6/6)», `2026-09-11T08:27:49Z ok room-drafts-mirror-still-throws: тест покраснел, как обязан`.

`--check` (дешёвая часть, патчи применимы) прогнан локально и тоже зелёный; сам факт «тест умеет падать» проверен по реальным логам прогона мутаций в CI на материале ревью, а не только по заявлению автора.

## Что проверено и корректно

1. **Порядок вызовов на пути `config/set` и `Optimize`.** `validate_wall_model_transition` вызывается раньше `CONFIG_SCHEMA` в обоих местах (`websocket_api.py:1665-1666` и `:2033-2042`) — риск, который сам автор попросил перепроверить («защита #478 не ослабла»), подтверждён прочтением кода.
2. **Механизм самолечения хранилища (К4).** `commitWallSegmentModel` (клиентское зеркало) действительно вызывается перед формированием кандидата `config/set` во всех точках структурной правки (`houseplan-editor-runtime.ts:2005,2030,2247,2405`, `draft-live-commit.ts:79,168`) — второй риск, названный автором, подтверждён прочтением.
3. **Идентичность зеркал.** Питоновская и TS-версии `_migrate_room_drafts_to_partitions`/`migrateRoomDraftsToPartitions` читаются построчно идентично (конверсия драфта в partition, генерация детерминированного id при коллизии, снятие ключа). Паритетная фикстура `#282` не тронута и осталась зелёной (`npm test`).
4. **Схемный инвариант (К4а).** `_config_wall_segment_invariants` (`validation.py:1923`) сменил `"room_drafts" in space` на `space.get("room_drafts")` — пустой список больше не триггерит `vol.Invalid`, непустой по-прежнему триггерит; тест на обе ветки существует и проверен построчно.
5. **i18n.** Новых ключей нет: `toast.wall_model_client_outdated` и `backup.error.wall_model_client_outdated` уже существуют во всех четырёх локалях (en/ru/de/fr) — заявление ТЗ подтверждено.
6. **Changelog/докс.** Оба чейнджлога в одном коммите с `User-Visible: yes`; `docs/CONFIG-COMPATIBILITY.md` переписан согласованно с новым поведением (раздел «Ordinary wall chains — model v10»).
7. **Трейлеры и провенанс.** `Issue: #529` на обоих коммитах; `User-Visible: yes` только там, где меняется поведение и есть оба чейнджлога; `User-Visible: no` на doc-коммите отпечатка скриншотов, который правит только `screenshots.json` (imageSha256 не изменился ни в одном кадре — «identical»-путь, не полная пересъёмка).
8. **Одно число — один источник:** правка не вводит новых видимых пользователю величин (тексты тостов не менялись); неприменимо.

## Находки

Нет. High: 0, Medium: 0.

Одно замечание отмечаю явно, чтобы не выглядело как незамеченное, но не поднимаю
до Low: питоновская `_migrate_room_drafts_to_partitions` использует
`drafts = space.get("room_drafts") or []` — истинное не-списочное значение
(строка/число/словарь) не приводится к `[]` и не снимается молча, в отличие от
TS-зеркала (`Array.isArray(...) ? ... : []`), что формально не полностью
покрывает букву К1 («пустой список **или не-список**»). Прочтением подтверждено,
что это недостижимо на практике: единственная схема `room_drafts`
(`validation.py:1743`, `vol.All([_LEGACY_ROOM_DRAFT_SCHEMA], ...)`) требует
список уже при записи, и все вызовы `commit_wall_segment_model` (`import_export.py`,
`junction_limits.py`, серверный `Optimize`-путь `websocket_api.py:2042-2050`)
получают конфиг, уже прошедший `CONFIG_SCHEMA` на предыдущей записи или в этом
же вызове раньше. Мёртвый код, не находка.

## Чего не проверял

- `python -m pytest tests_backend -q` локально — нет установленных
  `pytest`/`pytest_homeassistant_custom_component` в песочнице ревью; заменено
  ссылкой на зелёный прогон Validate на точном SHA материала плюс построчным
  чтением новых тестов и подтверждением по логам того же прогона, что три
  относящихся к этой задаче мутанта реально красят своих свидетелей.
- Полный браузерный набор смоков, `golden:verify`, perf-смок — не запускал:
  diff не меняет видимый рендер/геометрию отображения, AC их не требует; выбор
  `smoke-select.mjs` дал единственное прямое совпадение (`smoke_edit_walk`),
  оно прогнано и зелёное.
- `npm run invariants -- --config <...>` на конкретном экспортированном
  конфиге пользователя — такого конфига в материале ревью нет (issue не
  прикладывает файл, только синтетические конфиги автора и мои прогоны тестов);
  геометрические свойства миграции (сохранение id, `cm`, детерминированный
  id при коллизии) проверены напрямую через AC2/AC3 и общий прогон `npm test`.
- Ручного тестирования в UI не было (в процессе его нет в принципе) — вопрос
  «работает ли» закрыт цепочкой: клиентский юнит AC5а → серверные бэкенд-тесты
  AC1/AC2/AC4/AC5/AC6 → мутанты AC7, которые доказывают, что тесты способны
  упасть.

---

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/529-room-drafts-deadlock`, коммит `85e5d61fb183` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `51dee76b532b9bebeae46a0284f659aeb8be985c`
  ```
  git log --all --format='%H %T' | grep 51dee76b532b
  ```
- Тело issue: `817b8acec5b1a72336cf4cb0ecc1c5d583d5a9d5b6fa55d2aea6be5e50190eb1`
- Вердикт конвейера: `green` · High 0
