# Код-ревью #912 — заход r2

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
ровно `f05e3edec67db29281f7c1ba6c2522c81e1a224b` (рабочая копия на нём).
Трек: `ask`. Блокирующих циклов израсходовано 0 из 4.

## Почему r2, а не r1-продолжение

Первое ревью (SPEC-REVIEW-912-r1 и CODE-REVIEW-912-r1) было зелёным на дереве
`5865e09c9e3e6c425f8f9c8d901ecb11fbba1f66`. Пока шло код-ревью, `dev`
продвинулся на несколько коммитов дважды подряд (issue-комментарии
2026-10-15T15:53/16:05/16:17Z); автор получил `event continuation #856`,
пересобрал ветку ребейзом на новый `dev` дважды, и материал сменился на
`f05e3edec67db29281f7c1ba6c2522c81e1a224b`. Старый SHA `5865e09c` и его дерево
`a8b52e0396b9` в этом хранилище больше не резолвятся — ожидаемо для
осиротевшего ребейзом коммита (это не находка, см. докладную записку в
`CODE-REVIEW-912-r1.md`: «ребейз его осиротит, и это нормально»).

Per `docs/process/REVIEWER.md` («Повторный раунд»): ребейз на ушедший вперёд
`dev` — это не локальная дельта, разбор остаётся полным, а не сокращённым.
Поэтому ниже — полный независимый разбор всего диффа `origin/dev...HEAD`
(40 файлов), а не только «что изменилось с r1»; раздел «Унаследовано из r1»
ниже перечисляет то немногое, что не потребовало переповторения.

## Скоуп

Issue #912: сохранить успешно полученные карты связей Zigbee2MQTT между
перезапусками Home Assistant/интеграции до явного действия пользователя
(«Обновить карту» или сохранённое выключение связей). Контракт поведения,
AC1–AC7 и решение владельца 1б (принятый Refresh удаляет старую карту сразу,
ошибка/отмена её не возвращают) зафиксированы в теле issue, прошли зелёное
SPEC-REVIEW-912-r1 и не менялись с того ревью (тело issue то же самое, тот же
`hp:z2m-persistent-topology-20261015` якорь).

Коммиты в материале (`git log --oneline origin/dev..HEAD`):
`2d331761` (feat, User-Visible: yes), `965ae7b9` (build: два owner-approved
потолка бюджета), `67a0f412` (docs: evidence), `bc0d9522` (docs: review r1),
`f05e3ede` (docs: индекс после сдвига каталога). Все пять несут `Issue: #912`;
`User-Visible: yes` только на `2d331761`, с правкой обоих changelog в том же
коммите.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate ровно на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/38767840045,
`issue/912-z2m-durable-topology` @ `f05e3ede`, `conclusion: success`). Разбор
по диффу/AC — лично, чтением кода и тестов; отдельно перепроверил по логам
CI, что бэкенд-гейт не «потерян» под переиспользованием.

| Гейт | Результат | Источник |
| --- | --- | --- |
| `npx tsc --noEmit` / `npm test` / `npm run build` + bundle-policy | PASS | job «Фронтенд: типы, юниты, мутанты, синхрон бандла» в прогоне `38767840045` |
| `pytest tests_backend` | Переиспользован (job «Переиспользование: это дерево уже проверено»), не повторный провал/пропуск | Лог job `116535737165`: `ci-proof.mjs` печатает `source_run=38755995729 source_sha=43e25c6e...`, ключ кеша по хешу бэкенд-входов (`scripts/gate-reuse.mjs`, #208) совпал — backend-релевантное дерево (Python-файлы + `tests_backend/`) побайтово то же, что в прогоне `38755995729`, где `pytest` реально выполнен: 1494 passed / 1 skipped. Проверено не на слово автора, а чтением лога job'а переиспользования |
| `golden:verify` (`ci:golden`, обязателен — риск в `hp-zigbee-topology-overlay.ts`) | PASS, свежий прогон (не reuse) | job «Golden-кадры против принятых эталонов», тот же прогон `38767840045`, `conclusion: success` |
| Смоки в браузере (3 шарда) | PASS | тот же прогон |
| Перф-смок | PASS | тот же прогон (не требуется AC, но прошёл) |
| `mutation-gate --check` (статика) | не исполнялся — job «Мутанты по диффу» помечен `skipped`, nightly-only; это не находка (#709) | тот же прогон |
| `pytest`/`geometry_parity`/«Бандл головы dev» | `skipped` (не требуются: нет геометрии/perf-заявки в AC) | тот же прогон |
| `node --test test/coordinate-write-barrier-guard.test.mjs` | Проверено чтением: ровно один `config_store.async_save` вызов в `store.py:238` внутри `save_config()` | чтение дерева |

Не прогонял сам: ни один из перечисленных гейтов — опираюсь на зелёный
Validate для этого точного SHA и отдельно сверил, что backend-переиспользование
действительно указывает на прогон, где `pytest` реально исполнялся (а не на
другое переиспользование, маскирующее непрогнанный HA-harness). Полные
(не выборочные) performance-серии и полный golden вне уже пройденной матрицы
не требовались.

## Разбор по рискам, названным в промпте (трек ask — каждый класс закрыт строкой ТЗ)

- **migration** (`store.py:234–239` — обёртка `config_store.async_save` в
  `async_save_config_state` через `zigbee.async_save_config`): структура
  подтверждена чтением — единственный Store-writer callback
  (`coordinate-write-barrier-guard` не ослаблен), клир выполняется ДО
  `save_config()`, отказ клира отменяет весь `config/set`
  (`websocket_api.py:1788–1795`). Контракт п.6 ТЗ закрывает это требование.
  **Внутри этого же участка нашёл Medium-находку** — см. ниже.
- **devices** (`websocket_api.py:1791–1795` catch вокруг
  `async_save_config_state`, `websocket_api.py:1509–1513` флаг
  `zigbee_maps_api: 1` в `ws_config_get`): фронтенд требует оба флага
  (`zigbee-topology-runtime.ts:159` `result?.zigbee_scan_api !== 1 ||
  result?.zigbee_maps_api !== 1`). Админ-гварды на всех трёх WS-командах
  сохранены (`zigbee_websocket.py:31,63,82` — `@websocket_api.require_admin`
  на subscribe/start/cancel, не ослаблены). Контракт «Capability и
  совместимость WS…», AC5/AC7 — закрыто.
- **ux** (29 новых i18n-ключей `backup.error.storage_clear/storage_read` в
  `src/i18n/{de,en,fr,ru}.json` и `storage_pending/storage_failed/
  error_storage_read/error_storage_clear/error_capacity_exceeded/
  error_disabled` в `src/i18n/topology/{de,en,fr,ru}.json`): все четыре локали
  присутствуют и для основного, и для topology-namespace; `z2m_warning`,
  `scan_backend_required` переформулированы во всех 4 локалях синхронно
  (прочитаны de/en/fr/ru построчно — не противоречат новому контракту, нет
  устаревшего «фоновое сканирование» обещания). Раздел ТЗ «i18n» закрыт.

Все три класса закрыты строками ТЗ — реклассификация (`route: reclassify`) не
требуется; маршрут вердикта — `fix` (трек `ask`, как и указано в промпте).

## Находки

### Medium (в скоупе) — «устаревшее»/«чужое» хранилище карт Zigbee не просто
отклоняет один запрос, а блокирует Refresh и выключение функции навсегда,
без восстановления через продукт

**Файлы:** `custom_components/houseplan/zigbee_topology.py:188,206–233`
(`async_setup`, установка `self._storage_error`), `zigbee_topology.py:235–244`
(`_save`, безусловная проверка `self._storage_error` в начале), `:340–367`
(`_start`, каждый Refresh вызывает `_save` перед сканом), `:246–262`
(`async_save_config`, выключение вызывает `_save({})` при переходе
enabled→disabled).

**Воспроизведение (чтением; обычный тестовый сценарий уже есть в материале,
без правки продукта):** существующий тест
`test_issue_912_invalid_store_is_preserved_and_cannot_start_a_radio_scan`
(`tests_backend/test_ha_zigbee_topology.py:386–412`, параметризован
`future`/`foreign`/`topic`/`nodes`/`time`) кладёт в `Store` синтаксически
валидный, но семантически некорректный payload (например, «будущая» схема,
`schema: 2`, или чужой `entry_id` после восстановления бэкапа на другом
инстансе — сценарий прямо назван в разделе issue «Основание»: «Сохранённая
карта не должна смешиваться между разными HA-инстансами»). После
`async_setup_entry` интеграция сама видит и обрабатывает это как ошибку:
`self._storage_error = "storage_read"` (строка 232) устанавливается один раз
и **никогда не очищается** — ни в `_save` на успешной записи, ни где-либо ещё
в файле (`grep -n "_storage_error" zigbee_topology.py` даёт ровно 4 вхождения:
объявление, установка, две проверки). Тест подтверждает первый симптом:
`refused["error"]["code"] == "storage_read"` на первой же попытке `start`.

Но из-за того, что `_save()` безусловно проверяет `self._storage_error`
**до** попытки реальной записи (строки 237–238), это не разовый отказ, а
постоянное состояние на весь срок жизни интеграции (до следующего
`async_setup_entry`, который читает тот же неисправленный файл и получает ту
же ошибку заново — испорченный файл никогда не перезаписывается, потому что
попытка записи блокируется ещё до вызова `self._store.async_save`):

1. Любой следующий Refresh по **любому** топику (не только изначально
   «плохому») отказывает с `storage_read`, потому что `_start` (строка ~366)
   безусловно вызывает `await self._save(...)` перед стартом нового скана —
   независимо от того, нужна ли вообще очистка для этого топика.
2. Сохранённое выключение функции («Показывать связи Zigbee…» → off → Save)
   тоже отказывает: `async_save_config` (строка 248) вызывает `self._save({})`
   при переходе enabled→disabled, эта запись тоже блокируется, и весь
   `config/set` целиком отклоняется (`websocket_api.py:1791–1795` пробрасывает
   `ZigbeeScanError` наружу как есть).
3. Новый **успешный** скан тоже не сохраняется: `_persist` (строка ~264)
   вызывает тот же `_save`, получает ту же ошибку и помечает
   `job.persistence = "failed"` — карта видна в текущей сессии, но навсегда
   остаётся несохранённой, даже если причина первоначального отказа чтения
   не имеет отношения к текущей записи (например, «foreign entry_id» не
   мешает физически записать новый валидный payload поверх).

Итог: пользователь видит объяснимую ошибку (`error_storage_read` /
`backup.error.storage_read`, «Check HA storage and integration version»), но
для сценариев `foreign`/`nodes`/`topic`/`time` это сообщение не указывает
реального пути восстановления (в отличие от `future`, где подсказка
«обновите интеграцию» действительно работает) — функция Zigbee-связей
(и Refresh, и Disable) фактически выключена до тех пор, пока администратор
вручную не отредактирует/не удалит файл `.storage/houseplan.zigbee_maps.
<entry_id>` через файловую систему, что продукт не предлагает и не
документирует как путь восстановления.

**Чем красит/не красит:** это не AC с пустой колонкой «чем краснеет» — сам
факт, что `start`/`async_save_config` отказывают после обнаружения плохого
кеша, прямо доказан существующим тестом
(`test_issue_912_invalid_store_is_preserved_and_cannot_start_a_radio_scan`,
PASS). Находка — в том, что ТЗ (п.6, п.8) требует явную и понятную ошибку
на **этот конкретный** отказ записи, но не требует и не обсуждает
**перманентность** отказа для всех последующих, логически не связанных
операций; код реализует более строгую и более ломающую семантику, чем
заявлено, и это нигде не раскрыто как сознательный компромисс (в отличие от
аналогичного по духу, но прямо документированного в r1 нюанса «successful
clear → failed config write» в `CONFIG-COMPATIBILITY.md`). Не нахожу
отдельного ordinary negative-input теста или зарегистрированного мутанта,
который проверял бы именно «а можно ли оправиться после первого отказа» —
такого сценария в тестовом файле нет (проверено: `grep -n "^async def
test_issue_912"` даёт 9 тестов, ни один не делает второй `_setup`/`start`
после detected-corruption сценария).

**Почему Medium, не High:** отказ fail-safe (данные не теряются и не
портятся, не записывается тихий пустой snapshot — ТЗ п.8 в этой части
выполнено), сценарий требует редкой предпосылки (ручная/бэкапная подмена
хранилища, будущая схема, повреждение), не единственный сценарий — обычный
Refresh/Disable без предшествующей порчи кеша работает штатно и подтверждён
тестами ниже. Но рекомендую фикс до мержа: ограничить эффект `_storage_error`
только диагностикой при старте (поле `error` в `initial_events`), а саму
`_save()` не блокировать навсегда по историческому факту чтения — пусть явная
команда пользователя (Refresh/Disable) всегда пробует настоящую запись и сама
решает по её результату (как уже сделано для обычного `OSError` в
`test_issue_912_clear_failure_refuses_refresh_and_saved_off_without_publish`,
где отказ — за вызов, а не навсегда).

Других High/Medium не нашёл.

## AC — чем доказаны, чем краснеют

Таблица идентична по составу таблице `CODE-REVIEW-912-r1.md` — backend-файлы
и тесты в этом материале побайтово те же (подтверждено переиспользованием
гейта, см. «Как проверялось»); я перечитал сами тесты (не только их имена) и
подтверждаю соответствие.

| AC | Доказательство | Чем краснеет |
| --- | --- | --- |
| AC1 restore | `test_issue_912_success_survives_real_entry_reload_without_radio_scan` (строка 175): реальный `async_unload`/`async_setup`, тот же `obtained_at`, `stale=True`, 0 MQTT publish при restore | Pre-impl RED на неизменённом коде; зарегистрированный мутант `zigbee-durable-reload-discards-successful-maps` — не исполнялся (nightly-only) |
| AC2 Refresh/OFF | `test_issue_912_refresh_durably_forgets_old_map_even_when_replacement_fails` (204), `test_issue_912_clear_must_finish_before_mqtt_and_replacement_is_durable` (243), `test_issue_912_clear_failure_refuses_refresh_and_saved_off_without_publish` (274), `test_issue_912_failed_success_save_is_honest_and_never_promises_reload_survival` (308) | Мутант `zigbee-durable-refresh-keeps-old-map-on-disk` — не исполнялся; ordinary `monkeypatch`-отказ `Store.async_save` в тесте 274 — обычный негативный вход, воспроизведённый чтением |
| AC3 bounds/recovery | `test_issue_912_eight_slots_never_evict_a_successful_map` (675), `test_issue_912_topic_removal_keeps_exact_cache_and_reload_does_not_scan` (362), `test_issue_912_invalid_store_is_preserved_and_cannot_start_a_radio_scan` (386, параметризован 5 вариантами) | Обычные негативные входы — 9-й топик отклонён, повреждённые payload'ы не читаются как карта (см. также находку Medium выше — отказ подтверждён, но его перманентность не проверена отдельным тестом) |
| AC4 authority/privacy | `@websocket_api.require_admin` на все три WS-команды не тронут (`zigbee_websocket.py:31,63,82`); `test_issue_912_only_saved_off_clears_all_topics_and_fences_old_callbacks` (329) | Существующие admin/foreign-reply тесты не изменены |
| AC5 runtime | `zigbee-topology-runtime.ts` — явный authoritative-clear при отсутствии result (строки 134–138, прочитано, логика корректна: `cache.topologies` фильтруется и переcобирается на каждый provider-state, а не просто дописывается) | Мутант `zigbee-durable-feed-retains-cleared-browser-routes` — не исполнялся |
| AC6 native | `demo/smoke_zigbee_topology_job.mjs`, `demo/smoke_zigbee_tooltip_layout.mjs` — прошли в составе прогона `38767840045` (шарды браузерных смоков PASS) | Обычное отрицательное поведение видно прямо в ассертах смоков |
| AC7 docs/copy | `CONFIG-COMPATIBILITY.md`, `USER-GUIDE(.ru).md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, оба `CHANGELOG`, `release-ledger/v1.80.1/912.json` — прочитаны построчно в этом раунде | Не защитный AC — проверено чтением |

## Проверено и корректно

- Трейлеры `Issue: #912` на всех пяти коммитах материала; `User-Visible: yes`
  только на `2d331761`, в том же коммите правятся оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) — проверено `git show`.
- Бюджетные потолки: `scripts/bundle-budget.mjs`
  (`LAZY_EDITOR_GZIP_CEILING = 265_955`) и
  `scripts/monolith-baseline.json` (`bundleBytes: 2936529`) — ровно те два
  числа, что владелец одобрил в issuecomment-6194871293 (перечитал
  issue-комментарии: запрос на именно эти два числа и ответ «1а — принять
  эти два потолка» присутствуют). Обе 2000-байтные полосы и прочие лимиты не
  тронуты. Одно число — один источник: оба значения определены только в этих
  двух файлах.
- `release-ledger/v1.80.1/912.json`: `category: major` относительно
  `v1.80.1`, обоснование — новая пользовательская возможность, не
  внутри-бетное исправление; `introducedBy` не требуется (не промежуточная
  правка одной беты). Корректно попадает в пользовательский milestone.
- Эвикция (`_start`, строка ~351) теперь явно обходит топики с `result is not
  None` (успешные карты) при выборе кандидата на вытеснение — соответствует
  AC3 «восемь успешных карт никогда не вытесняются», точный отказ
  `capacity_exceeded`, если кандидатов нет, вместо тихого удаления чужой
  валидной карты (контракт п.8).
- Порядок вызова `zigbee_coordinator.async_setup` в `__init__.py:236–238` —
  после загрузки `config_payload` из `config_store`, с комментарием «A
  pre-recovery half of an interrupted import must not erase the map cache» —
  соответствует контракту п.2 (нет ложного authoritative reset до завершения
  restore).
- Overlay (`hp-zigbee-topology-overlay.ts:527–531`) фильтрует отображаемые
  маршруты по текущему списку `z2mTopics`, не удаляя данные — соответствует
  контракту п.5 («обновление списка топиков… не стирает молча»).
- `_cache_exists`/`MAX_CACHE_BYTES` ограничивают размер файла до парсинга в
  executor job — не блокирует event loop.
- Golden (`ci:golden`, риск в `hp-zigbee-topology-overlay.ts`) зелёный на этом
  точном SHA, не переиспользован со старого дерева — подтверждено логом
  `38767840045`.

## Унаследовано из r1 (без повторной проверки в этом раунде)

| Что | Документ/материал r1 | Почему не повторял |
| --- | --- | --- |
| SPEC-REVIEW-912-r1 (зелёный, AC1–AC7 однозначны, вопрос 1а/1б снят владельцем) | `docs/reviews/SPEC-REVIEW-912-r1.md`, тело issue digest `cc7b0e74…` | Тело issue не менялось между r1 и r2 (тот же `## ТЗ`, тот же якорь `hp:z2m-persistent-topology-20261015`) |
| Факт реального прогона `pytest tests_backend` (1494 passed/1 skipped, HA-harness собран, 597 `test_ha_*`) | прогон `38755995729`, commit `43e25c6e` | В этом раунде заново проверил цепочку переиспользования (job `116535737165`) и убедился, что она указывает на тот же источник — не слепое доверие, но сам факт первого прогона не переисполнял |
| Одобрение владельцем двух потолков бюджета (2936529 / 265955) | issuecomment-6194871293, issuecomment-6195062293 (ответ «1а») | Неизменный внешний факт (комментарий в issue), перечитан, не переисполнял сборку заново отдельно от Validate |

## Чего не проверял

- Не прогонял `tsc`/`npm test`/`npm run build`/`pytest tests_backend`/
  `golden:verify` локально — зелёный Validate на этом точном SHA
  (`38767840045`) и отдельно сверенная цепочка переиспользования backend-гейта
  достаточны.
- Не исполнял зарегистрированные мутанты и не трогал продукт/бандл/гарды
  вручную — только чтение; политика отрицательных проверок это не требует
  (execution — только ночь).
- Не писал и не исполнял новый тест на «перманентность» найденной Medium —
  вывод сделан чтением кода (`_storage_error` ни разу не очищается во всём
  файле) и сопоставлением с существующим тестом, который проверяет только
  первый отказ, не повторные попытки; само это и есть находка (пустой тест на
  восстановление — его отсутствие является частью находки, не моим
  допущением).
- Полные (не выборочные по диффу) performance-серии и полный golden-набор вне
  уже пройденной матрицы не гонял — ТЗ их не требует, матрица уже прошла в
  Validate.
- Ручного HA/браузерного тестирования не делал (цикл этого не предусматривает).
- Не проверял поведение HA Store при настоящей JSON-порче файла (не
  семантической, а синтаксической) — в этом случае, по документации HA,
  `Store.async_load()` сам переносит файл в `.corrupt` и возвращает `None`,
  что должно самоизлечиваться на следующей загрузке; не исполнял это отдельно,
  полагаюсь на описание механизма HA Store и на то, что это не тот путь, что
  порождает находку выше (находка — про семантически невалидный, но
  синтаксически корректный JSON, который HA Store не трогает).

## Вердикт

Жёлтый. Одна находка Medium в скоупе (постоянная блокировка Refresh/Disable
после однократного обнаружения семантически некорректного/чужого кеша карт
Zigbee, без пути восстановления через продукт) — возвращается автору на
исправление в этом же issue. High не найдено. Остальной разбор (AC1–AC7,
трейлеры, бюджеты, release-ledger, i18n, admin-гварды, golden) — без находок.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/912-z2m-durable-topology`, коммит `f05e3edec67d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bf496130ab5fa59484b1712c283dd773ca9441a8`
  ```
  git log --all --format='%H %T' | grep bf496130ab5f
  ```
- Тело issue: `cc7b0e742ffa10286fad8065696571b52f549fa3b091fee850f46af9e686bd62`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwNDAsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTN9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjcwLCJvdXRwdXRfdG9rZW5zIjo1MzcxOCwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNjI0NTQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo0MTI0OTQ2LCJjb3N0VXNkRXN0aW1hdGUiOjIuMDEyMTI1Mn1dLCJ0dXJucyI6NDEsImR1cmF0aW9uTXMiOjY1NzY5NywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuMDE3MjU1MTk5OTk5OTk5NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5110 output_tokens=53736 cache_creation_input_tokens=162454 cache_read_input_tokens=4124946 num_turns=41 -->
