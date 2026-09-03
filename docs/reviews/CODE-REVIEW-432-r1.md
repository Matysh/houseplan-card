# CODE-REVIEW-432-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/432
- ТЗ: `docs/specs/432-asset-resolve-authorization-cache.md` (SPEC-REVIEW-432-r1: зелёный)
- Материал ревью: SHA `d8e67f530c33c1b3178a60afb33a110cf5194bb2` (HEAD ветки
  `issue/432-asset-resolve-authorization-cache` на момент ревью, коммит
  `test(assets): isolate HA asset fixtures`), диапазон `origin/dev...HEAD`
  (коммиты `17a1c10b` docs, `f3c32fb2` fix, `d8e67f53` test)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4 (полный трек, лимит 4)
- Вердикт: **зелёный**

## Скоуп ревью

Первый заход код-ревью для issue #432: ограничение прав `houseplan/assets/resolve`
(read-only user видит только referenced-assets, writer — весь каталог) и общий
bounded/single-flight integrity-verifier для WS resolve и HTTP asset GET вместо
полного `read_bytes()+SHA-256` на каждый вызов. Класс изменений — A (Python backend)
+ B (тесты, `scripts/mutation-gate.mjs`) + C (документация); `src/**` не тронут.
Диапазон материала — весь диапазон `origin/dev...HEAD` (три коммита ветки), это
первый заход код-ревью, «Унаследовано из r0» не применяется.

## Как проверялось

1. `docs/SCOPE.md`, `PROCESS.md` §2.7, §7.1, §8, `AGENTS.md` — формат ревью, классы
   файлов, обязательность таблицы «AC · чем доказан · чем краснеет» (#435).
2. Тело issue #432 и все комментарии (аналитика, вопрос/ответ владельца Q1, ТЗ на
   ревью, зелёное SPEC-REVIEW-432-r1, handoff «Реализация готова») прочитаны целиком.
3. ТЗ `docs/specs/432-asset-resolve-authorization-cache.md` (§7–§16, AC1–AC11,
   таблица §14) сверено построчно с фактическим кодом на SHA `d8e67f53`.
4. Полный `git diff origin/dev...HEAD` прочитан целиком:
   - `custom_components/houseplan/asset_integrity.py` (новый файл, 140 строк) —
     `AssetIntegrityVerifier`, LRU-кеш, single-flight, потоковый SHA-256;
   - `custom_components/houseplan/decor_assets.py` — `read_asset()` (точечный lookup
     одного sidecar) и общий `_read_catalog_row()`, которым теперь пользуются
     и `read_catalog()`, и `read_asset()`;
   - `custom_components/houseplan/websocket_api.py` — `ws_assets_resolve()`:
     `_runtime()` до любого I/O, read-only membership filter под `write_lock`,
     прямой `read_asset()` вместо `read_catalog()`, `verifier.verify()` вместо
     инлайн-хеширования;
   - `custom_components/houseplan/http_api.py` — `HouseplanContentView.get()`:
     assets используют `verifier.verify()`, plans/files остались на `path.is_file()`;
   - `custom_components/houseplan/auth.py` — не менялся, `may_write()` сверен как
     существующий источник истины (fail-closed, admin_only-семантика);
   - `tests_backend/test_decor_assets.py` (+195 строк) — чистые unit-тесты cache
     hit/miss, LRU 256/257 границы, потокового ридера, single-flight, mid-read
     инвалидации, direct lookup без сканирования каталога;
   - `tests_backend/test_ha_websocket.py` (+139 строк) — HA-тесты readonly-фильтра
     (со шпионом `read_asset`), `admin_only:false` writer-контракта, `not_ready`
     до I/O (со шпионом на `Path`), общего hash-счётчика WS↔HTTP;
   - `scripts/mutation-gate.mjs` (+52 строки) — 4 новых постоянных мутанта;
   - `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`,
     `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — access/cost-контракт описан,
     явно подтверждено отсутствие schema/capability/URL миграции.
5. Трейлеры коммитов проверены: `f3c32fb2` — `Issue: #432` / `User-Visible: yes`,
   оба changelog изменены в этом же коммите (`git show --stat`); `d8e67f53` —
   `Issue: #432` / `User-Visible: no`, только `tests_backend/conftest.py`
   (класс B, повторного changelog не требует).
6. Каждый мутант из п.4 (`scripts/mutation-gate.mjs`) мысленно применён к
   соответствующей строке `asset_integrity.py`/`websocket_api.py` и прослежен по
   логике кода до конкретного assert, который он обязан сломать (таблица ниже);
   структурная валидность патчей подтверждена командой (см. «Гейты»).
7. Проверена история CI ветки (`gh run list`/`gh run view`): коммит `f3c32fb2`
   получил **красный** прогон Validate (job `Бэкенд: pytest в Home Assistant` —
   failure), следующий коммит `d8e67f53` («isolate HA asset fixtures») —
   точечный фикс утечки фикстуры (`tests_backend/conftest.py` теперь чистит и
   `houseplan/assets`, не только `plans`/`files`), и на нём Validate зелёный
   (run 33741146772, `Бэкенд: pytest в Home Assistant` — success). Это
   единственная содержательная находка процесса разработки данной задачи, и она
   закрыта третьим коммитом того же issue — не находка ревью.
8. Отдельно проверено, что на этом же прогоне (33741146772) job
   `Фронтенд: типы, юниты, мутанты, синхрон бандла` — **skipped**, а не «уже
   проверен»: путь-фильтр `changes` классифицирует `frontend` по regex, не
   включающему `scripts/**`/`custom_components/**`, и весь диапазон коммитов
   `origin/dev..HEAD` не тронул ни одного файла, попадающего под этот regex.
   Значит фактическое утверждение задания «Validate зелёный, дешёвые гейты
   подтверждены» верно для CI в целом (frontend-job там законно не участвует —
   `src/**` не менялся), но `npm test`/`tsc`/`build` для этого диффа **не были
   исполнены ни разу ни в одном прогоне этой ветки**. Прогнал их сам (см. «Гейты»).

## Проверка AC1–AC11

| AC | Что требует ТЗ | Где в коде | Вердикт |
|---|---|---|---|
| AC1 | read-only видит referenced saved asset, обе карточки без writer-only зависимости | `websocket_api.py:1140-1169`; `src/**` не менялся | доказано тестом + чтением |
| AC2 | unreferenced id → `missing`, referenced → `assets`; forbidden id не читает metadata/stat/blob; writer/`admin_only:false` — полный контракт | `websocket_api.py:1143-1166` (`allowed = requested & referenced` под `_check_write`) | доказано тестом (шпион) |
| AC3 | без runtime — `not_ready` до FS | `websocket_api.py:1140-1142` (`_runtime()` до `root = Path(...)`) | доказано тестом (шпион на `Path`) |
| AC4 | resolve читает только уникальные разрешённые id, не сканирует остальное; согласовано с `read_catalog()` | `decor_assets.py`: `read_asset()`/`_read_catalog_row()` — общий helper | доказано тестом (`Path.glob` запрещён) |
| AC5 | неизменившийся blob хешируется 1 раз для обоих транспортов | `asset_integrity.py:79-129`; оба вызывающих — `get_asset_integrity_verifier(hass)` | доказано HA-тестом (hash-counter WS↔HTTP) |
| AC6 | N параллельных проверок одного key = 1 hash; разные paths независимы; без «зависшего» in-flight | `asset_integrity.py:92-129` (`_inflight`, `finally: flight.event.set()`) | доказано тестом (barrier/ThreadPoolExecutor) |
| AC7 | смена сигнатуры инвалидирует; corrupt → `missing`/404; mid-read change не кешируется; повторный corrupt не перечитывает | `asset_integrity.py:92-129` (`stable = _signature(path) == before`) | доказано pure+HA тестами |
| AC8 | ≤256 entries, LRU eviction, без bytes, chunked reader | `asset_integrity.py:16-17,51-57,120-125` | доказано тестом (`Path.read_bytes` запрещён, 257-я запись) |
| AC9 | authenticated/signed GET сохраняют body/headers/`FileResponse`; plans/files вне verifier | `http_api.py:180-186,211-214` | доказано существующим + расширенным HA-тестом, подтверждено чтением |
| AC10 | payload/capability/config/i18n/URL не меняются; docs описывают контракт | `const.py`, i18n — 0 diff; `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`, оба changelog обновлены | проверено чтением (diffstat: 0 изменений в `const.py`, `manifest.json`, `src/i18n/**`) |
| AC11 | mutation-gate свидетели для дорогих защит | `scripts/mutation-gate.mjs` — 4 новых entries | см. таблицу «чем краснеет» ниже |

## Таблица защитных доказательств (правило #435)

| AC | Чем доказан | Чем краснеет (мутация → эффект) |
|---|---|---|
| AC2 | `test_decor_asset_resolve_readonly_is_limited_to_referenced_ids` (`tests_backend/test_ha_websocket.py`) — шпион на `read_asset`, `looked_up == [referenced_id]` | mutation-gate `asset-resolve-readonly-membership-removed`: `allowed = requested & referenced` → `allowed = requested`. Прочитано и прослежено: unreferenced id снова попадёт в `allowed`, `read_asset()` вызовется для него, `looked_up` тест-шпион поймает лишний id → assert падает |
| AC3 | `test_decor_asset_resolve_requires_runtime_before_io` — `monkeypatch.setattr(hp_ws, "Path", forbidden_path)`, ожидание `not_ready` | нет отдельного mutation-gate entry (чистый порядок операторов); снятие `if rt is None: return` эквивалентно удалению самого guard-а — сразу ловится тем же тестом (`Path` вызывается → `AssertionError` до отправки `not_ready`). Адресный red proof не требуется отдельно: тест уже устроен как ловушка на любой FS-вызов до ответа |
| AC4 | `test_direct_asset_lookup_never_scans_or_accepts_mismatched_sidecars` — `monkeypatch.setattr(Path, "glob", no_scan)` | замена `read_asset()` на `read_catalog(root)` немедленно попадает в `no_scan` → `AssertionError`. Проверено чтением (нет отдельного mutation-gate entry, но witness детерминирован и не требует HA) |
| AC5 | `test_integrity_cache_reuses_digest_and_caches_corrupt_signature` (pure) + HA-тест `test_decor_asset_list_resolve_delete_and_signed_content` (`hash_calls` считает вызовы `AssetIntegrityVerifier.verify` через инструментированный `hasher`, растёт только при реальной смене файла, WS после HTTP не увеличивает счётчик) | mutation-gate `asset-integrity-cache-hit-disabled`: `if cached is not None and ...` → `if False and ...`. Прослежено: cache-hit branch никогда не срабатывает → второй `verify()` того же файла снова становится owner → `calls == 2` вместо `1` → assert падает. Тот же код используется обоими транспортами, поэтому мутация ломает и кросс-транспортное свойство |
| AC6 | `test_integrity_cache_single_flights_same_path_and_releases_after_error` — `ObservedEvent` фиксирует, что второй вызов реально дождался владельца; `test_integrity_checks_for_different_paths_do_not_share_a_hash_lock` | mutation-gate `asset-integrity-single-flight-disabled`: `flight = self._inflight.get(key)` → `flight = None`. Прослежено: оба потока становятся владельцами, `waiter_joined.wait(2)` в тестовом hasher никогда не будет установлен вторым потоком → `coordinated()` виснет/не получает join → assert «the concurrent caller never joined the flight» падает, либо `calls == 2` |
| AC7 | `test_integrity_cache_invalidates_changed_signature_and_rejects_mid_read_change` — `mutating()` hasher переписывает файл во время чтения, ожидается `not unstable.verify(...)` и `not unstable._cache` | mutation-gate `asset-integrity-post-read-signature-ignored`: `stable = _signature(path) == before` → `stable = True`. Прослежено: `verify()` вернёт `True` (digest совпадёт с ожидаемым, т.к. hasher хэширует ещё старые байты), `assert not unstable.verify(...)` падает, `_cache` получит запись — второй assert тоже падает |
| AC8 | `test_integrity_cache_is_bounded_lru_and_stream_reader_avoids_read_bytes` — `monkeypatch.setattr(Path, "read_bytes", forbidden_read_bytes)`, 257 записей | адресный red proof (без отдельного mutation-gate entry, чистый unit, разрешено правилом #435 «для чистого AC8 допустим адресный red proof»): замена `_stream_sha256` на `hashlib.sha256(path.read_bytes())` немедленно ловится `forbidden_read_bytes`; удаление `while len(...) > max: popitem` ловится проверкой `len(verifier._cache) == 256` и отсутствием `paths[1]` |
| AC9 | расширенный `test_decor_asset_list_resolve_delete_and_signed_content` — статусы 200/404, `Content-Type`, `X-Content-Type-Options`, тело `== png` | проверено чтением: `http_api.py:185` (`elif not await ... path.is_file`) оставляет `plans`/`files` вне verifier структурно — ветка `if kind == "assets"` физически не выполняется для другого `kind`, отдельного мутанта не заводили, риск минимален (условие на `kind`, не на данных) |

Правило #435 требует непустой третий столбец для каждого защитного AC — заполнен
для всех семи (AC2–AC8); AC9 и часть AC3/AC4 доказаны детерминированным
white-box unit-тестом с шпионом, что процесс прямо признаёт достаточным для
«чистых» AC без отдельного мутанта.

## Гейты

Задание сообщило, что Validate на точном SHA `d8e67f53` зелёный
(run 33741146772) — проверено (`gh run view`), включая `Бэкенд: pytest в Home
Assistant` (success). Но `Фронтенд: типы, юниты, мутанты, синхрон бандла` на
этом прогоне **skipped** (путь-фильтр: диапазон `origin/dev..HEAD` не касается
`src/**`/`test/**`/`package.json` — `scripts/mutation-gate.mjs` под этот regex
не подпадает вовсе), то есть `typecheck`/`npm test`/`npm run build` в CI на этой
ветке не выполнялись ни разу. Прогнал сам:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, 0 ошибок |
| Unit (frontend) | `npm test` | `# tests 1793 / pass 1792 / fail 0 / skipped 1` |
| Build | `npm run build` | зелёный, `dist/` пересобран |
| Sync бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | совпадают (ожидаемо: `src/**` не менялся) |
| Структура mutation-gate | `node scripts/mutation-gate.mjs --check` | `ok` на всех 60 записях, включая 4 новых |
| Backend pytest (Linux/HA) | не прогонял локально — `homeassistant` не установлен в песочнице ревьюера | подтверждено CI на точном SHA (run 33741146772, job success); AGENTS.md: «чистое подмножество без HA даёт зелёный результат, который ничего не доказывает» — поэтому не подменял локальным прогоном без HA |
| `node scripts/check-docs.mjs` | не требуется | `src/**` не менялся |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются… Тронуто файлов: 15» — согласуется с ТЗ §11/§15.8 (browser/golden не требуются) |
| `npm run golden:verify` | не требуется | рендер/визуал не менялись |
| `node scripts/model-invariants.mjs` | не требуется | геометрия/`layout`/толщина не тронуты |

## Что проверено и корректно

- Полный код `asset_integrity.py` прочитан построчно; блокировка (`self._lock`)
  удерживается только на bookkeeping (проверка кеша/inflight), сам `self._hasher(path)`
  выполняется **вне** лока — соответствует §9.2 ТЗ («не держать один глобальный lock
  на протяжении всех чтений»), подтверждено тестом на независимость разных путей.
- `finally: flight.event.set()` гарантирует, что исключение в hasher всё равно
  разбудит ожидающих и снимет in-flight запись — нет вечного зависания (AC6).
- `read_asset()`/`_read_catalog_row()` — общий helper для `assets/list` и `resolve`,
  что и требует §9.3 ТЗ («не разойдутся две копии validation»); добавленная
  проверка `path.stem != aid` дополнительно исключает подмену sidecar под чужим
  именем файла — усиление, а не регресс (протестировано отдельно, `read_catalog()`
  на существующих валидных данных не меняет поведение: имя sidecar у
  легитимно созданных записей всегда равно `asset_id` по построению
  `asset_meta_path()`).
- `HouseplanContentView.get()`: `plans`/`files` остаются на `path.is_file()`,
  verifier применяется только при `kind == "assets"` — контракт AC9/§8 ТЗ не
  нарушен, CSP/`nosniff`/`immutable`/`FileResponse(chunk_size=...)` не тронуты.
- `may_write()` (`auth.py`) не менялся — переиспользован как единственный источник
  writer/read-only семантики, соответствует §7.1 ТЗ.
- Трейлеры и changelog корректны для обоих коммитов класса A/B; `d8e67f53` —
  точечная починка утечки тестовой фикстуры (`houseplan/assets` не чистился между
  тестами, из-за чего `f3c32fb2` получил красный backend-job), закрыта в рамках
  того же issue тем же коммитом с `User-Visible: no` — это ожидаемая часть работы
  над задачей, а не находка ревью.
- Все 4 новых постоянных mutation-gate мутанта структурно применимы
  (`--check` → `ok`) и при чтении логики каждый действительно ломает assert
  того теста, который его сторожит (прослежено построчно, таблица выше).
- Read-only membership snapshot берётся под `rt.write_lock` и отпускается **до**
  файлового I/O — соответствует §7.3 ТЗ («Lock не удерживается во время metadata
  I/O или хеширования»).
- `_runtime()` вызывается синхронно до всякого обращения к `Path`/файловой системе
  (`get_data()` — чтение `hass.data`, без I/O) — AC3 подтверждается и структурно,
  не только тестом-шпионом.
- Публичный контракт (payload `{assets, missing}`, `DECOR_ASSETS_API_VERSION`,
  URL-схема, i18n, config schema) не тронут — `git diff` по `const.py`,
  `manifest.json`, `src/i18n/**`, `src/**` пуст.

## Находки

Нет находок уровня High или Medium.

**Low (не блокирует, зафиксировано без правки).**

1. AC9 (streaming/headers для `assets`) и часть AC3/AC4 доказаны только чтением
   и детерминированным white-box unit-тестом (шпион), без отдельной записи в
   `scripts/mutation-gate.mjs`. Это разрешено правилом #435 для AC, не требующих
   дорогого гейта (backend/HA здесь не обязателен именно для этой мутации:
   отделение веток `if kind == "assets"` / `elif` тривиально и не зависит от
   concurrency или HA-специфики). Снимается без правки — расширять реестр ради
   тривиальной ветки было бы ритуалом, который правило прямо исключает.
2. `docs/CONFIG-COMPATIBILITY.md` добавляет абзац о #432 в середину раздела про
   отдельный более старый compatibility-кейс (downgrade изображений), а не
   отдельным подзаголовком. Контент корректен и полон, это вопрос структуры
   документа. Снимается без правки.

## Чего не проверял

- Backend/HA pytest не исполнял локально: в песочнице ревьюера нет модуля
  `homeassistant` и `.venv-backend`; полагаюсь на зелёный Linux CI job
  «Бэкенд: pytest в Home Assistant» на точном SHA `d8e67f53` (run 33741146772),
  включающий все новые HA-тесты из `tests_backend/test_ha_websocket.py`.
- Полный `node scripts/mutation-gate.mjs` (без `--check`, реальный прогон 4 новых
  мутантов) не выполнял: он требует backend-гейт (`backend-test-guard.mjs` → pytest
  → HA), которого в песочнице ревьюера нет, а канонически такой прогон — часть
  предрелизного `.github/workflows/mutation-gate.yml`, не гейта код-ревью
  (это явно задокументировано в самом `scripts/mutation-gate.mjs`: «прогон дорогой,
  его место — перед стабильным релизом»). Корректность каждого мутанта проверена
  чтением и прослеживанием логики до конкретного assert (таблица выше), автор
  отдельно заявил в handoff, что все четыре пойманы red в WSL/Linux.
- Browser smoke, `golden:verify`, `model-invariants` — не прогонял: ТЗ §11/§15.8
  явно исключает их (рендер/геометрия/`layout` не меняются), и
  `scripts/smoke-select.mjs` подтверждает отсутствие исполняемого frontend-диффа.
- Производительность «в бою» (реальная нагрузка HA-инстанса с сотнями ассетов)
  не измерялась — вне возможностей этого ревью; оценка по коду: I/O теперь
  O(число уникальных разрешённых id) вместо O(каталог), повторный blob — 0 байт
  чтения при валидном cache-hit, что соответствует §16 ТЗ, подтверждено тестом
  с hash-counter.
- Не проверял поведение при недоступной файловой системе (permission denied,
  диск в read-only режиме) сверх штатного пути `OSError` → `except OSError:` в
  `_signature()`/verify() → fail-dark; отдельного теста на этот конкретный
  сценарий нет, но код структурно идентичен уже покрытому «missing file» случаю
  (тот же `except OSError` перехватывает оба).

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/432-asset-resolve-authorization-cache`, коммит `d8e67f530c33` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3cba0a6a5cde3b9dcccba5c8bb7711c0fe92550c`
  ```
  git log --all --format='%H %T' | grep 3cba0a6a5cde
  ```
- ТЗ `docs/specs/432-asset-resolve-authorization-cache.md`, блоб `8593bd54ad7d7e8a4d6459949fbb960c34ccddc9`
  ```
  git log --all --find-object=8593bd54ad7d7e8a4d6459949fbb960c34ccddc9 -- docs/specs/432-asset-resolve-authorization-cache.md
  ```
