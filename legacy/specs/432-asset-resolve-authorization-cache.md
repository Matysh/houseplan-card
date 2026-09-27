# ТЗ #432 — Ограниченный resolve и единая проверка целостности изображений

- Issue: https://github.com/Matysh/houseplan-card/issues/432
- Приоритет / тип: P2 · bug · security
- Трек: полный — меняются два backend endpoint, публичный контракт доступа и
  стоимость файловых операций; критерии `small` из `PROCESS.md` не выполняются
- Связано: #51 (custom decor images), #131 (полный View read-only-пользователя),
  #421/#430 (исполняемые отрицательные доказательства)
- Решение владельца: Default по Q1 принят в issue 2026-09-03

## 1. Сценарий

**Персона:** домочадец без права редактирования либо администратор, открывающий
полный House Plan / отдельную карточку пространства. На плане есть загруженные
растровые или SVG-изображения декоративного слоя.

При загрузке View frontend разрешает сохранённые `asset_id`, подписывает URL и
рисует изображения. Параллельно прямой либо ошибочный клиент может многократно
вызывать `houseplan/assets/resolve` и GET тех же файлов. Проверка целостности не
должна превращать обычную загрузку или злоупотребление API в сотни мегабайт
повторного чтения с диска.

Задача обслуживает J1/J4/J6: View остаётся полным для household members,
пользовательский файл проверяется до показа, а интеграция остаётся устойчивой.

## 2. Что человек увидит до и после

**До:** сохранённые изображения отображаются, но каждый resolve/GET заново
читает файл целиком и считает SHA-256. Повторные или параллельные обращения могут
нагружать диск и задерживать Home Assistant. Попытка закрыть дыру обычной
write-проверкой, наоборот, убрала бы изображения у read-only-пользователя.

**После:** те же сохранённые изображения без новых сообщений и настроек видны
администратору, домочадцу, в full card и space card. Неизменившийся blob
хешируется один раз и переиспользуется обеими transport-поверхностями;
read-only-пользователь не может использовать resolve как просмотр всего
внутреннего asset-каталога.

## 3. Подтверждённая проблема

1. `ws_assets_resolve()` принимает до 200 id, сканирует каталог и для каждого
   совпавшего blob выполняет `path.read_bytes()` + SHA-256. При лимите 2 МиБ на
   файл это до 400 МиБ чтения за один вызов и снова столько же за следующий.
2. `HouseplanContentView.get()` перед каждым GET asset повторяет тот же полный
   `read_bytes()` + SHA-256. Заголовок `immutable` не защищает от прямого клиента
   и не объединяет full card со space card.
3. Общего cache/single-flight нет: два одновременных запроса могут независимо
   хешировать один и тот же blob.
4. `assets/resolve` не требует готового runtime и не различает writer и
   read-only user.
5. Действующее ТЗ #51 намеренно называет resolve `authenticated read`; обе
   карточки вызывают его в View. Поэтому безусловный `_check_write()` нарушит
   #131 и целевую персону из `docs/SCOPE.md`.

## 4. Решение владельца

Принят Default:

- non-admin при `admin_only` продолжает видеть сохранённые декоративные
  изображения;
- такой пользователь может разрешать только `asset_id`, на которые ссылается
  текущий сохранённый config;
- writer может разрешать любой существующий asset для редакторских сценариев;
- authenticated/signed GET точного content URL сохраняется;
- WS resolve и HTTP GET разделяют один ограниченный cache/single-flight по пути
  и файловой сигнатуре.

## 5. Скоуп

В задачу входят:

1. готовый runtime как обязательная предпосылка `assets/resolve`;
2. least-privilege фильтр requested ids для read-only connection;
3. сохранение полного resolve-контракта для `may_write == true`, включая случай
   `admin_only: false`;
4. прямое чтение metadata только для разрешённых requested ids вместо полного
   сканирования каталога;
5. один общий для WS и HTTP bounded integrity verifier;
6. cache по каноническому пути и файловой сигнатуре, включая размер и точные
   timestamps; cache хранит вычисленный digest, а не bytes;
7. single-flight для параллельной проверки одной файловой версии;
8. потоковый SHA-256 ограниченными chunks без `Path.read_bytes()`;
9. invalidation при изменении файловой сигнатуры, bounded eviction и fail-dark
   при исчезновении, I/O error, смене файла во время чтения или неверном hash;
10. backend/HA tests и постоянные mutation-witness для дорогих защит;
11. уточнение архитектурной и compatibility-документации, changelog RU/EN.

## 6. Не-скоуп

- изменение форматов PNG/JPEG/WebP/SVG, upload validation или лимита 2 МиБ;
- изменение namespace-квоты 200 файлов / 256 МиБ;
- новые rate limits, user-visible ошибки, repair, diagnostics или настройки;
- скрытие сохранённых изображений от household members;
- превращение content GET в writer-only endpoint;
- изменение signed URL, срока подписи, URL-формата, CSP, MIME или streaming
  `FileResponse`;
- удаление файлов, сборка мусора либо пересмотр standing rule из `SCOPE.md`;
- config/schema migration, новые persisted/compatibility-поля;
- frontend batching/cache, рендер, редакторы, touch-жесты и i18n;
- общий cache для plans, manuals, export/import и других файлов House Plan.

## 7. Контракт доступа к `houseplan/assets/resolve`

### 7.1. Предпосылки

- HA WebSocket authentication остаётся внешней обязательной границей.
- Handler первым получает runtime через действующий fail-closed путь. Если
  интеграция не готова, возвращается `not_ready`; каталог и blobs не читаются.
- `may_write(hass, connection.user)` остаётся единственным определением writer:
  admin при `admin_only: true` либо любой authenticated user при
  `admin_only: false`.

### 7.2. Writer

Writer может запросить любой корректный `asset_id` в пределах существующего
лимита сообщения. Для каждого id сервер напрямую читает одноимённую metadata
запись и проверяет соответствующий blob. Существующий ответ сохраняется:
валидный asset входит в `assets`, отсутствующий/невалидный/повреждённый — в
`missing`; дубликат присутствует не более одного раза.

### 7.3. Read-only user

Под `runtime.write_lock` берётся короткий coherent snapshot сохранённого config
и из него существующим `asset_refs()` строится множество разрешённых id. Lock
не удерживается во время metadata I/O или хеширования.

- Запрошенный id из множества используется так же, как у writer.
- Запрошенный id вне множества сразу попадает в `missing` и не вызывает чтение
  его metadata, stat либо blob.
- Ответ не различает «не существует», «повреждён» и «не разрешён». Это сохраняет
  partial resolve и не создаёт existence oracle.
- Один запрещённый id не отменяет разрешённые элементы той же пачки.

Config может измениться сразу после snapshot; это допустимая read-consistency.
Следующий resolve увидит новую сохранённую ревизию. Файл не удаляется на одном
факте исчезновения ссылки.

## 8. Контракт content GET

`GET /api/houseplan/content/assets/_/<hash>.<ext>` сохраняет существующие два
пути доступа: authenticated request либо валидная HA-подпись. Membership в
текущем config повторно не проверяется: подписанный URL обязан работать, а
content-addressed hash практически не перебирается.

До `FileResponse` asset проходит тот же integrity verifier, что WS. Неверный
digest, исчезновение или ошибка чтения дают прежний 404. Valid response
сохраняет exact MIME, CSP для SVG, `nosniff`, immutable private cache header и
потоковую отдачу. Plans/files этой задачей не меняются.

## 9. Integrity cache и ограничение стоимости

### 9.1. Identity

Cache key включает resolved canonical path; запись содержит файловую сигнатуру
и фактический SHA-256. Сигнатура включает как минимум `size`, `mtime_ns` и
`ctime_ns` (либо документированную точную платформенную замену). Ожидаемый hash
сравнивается с digest, а не становится единственным доказательством cache hit.

Перед использованием hit выполняется `stat`. Несовпадение сигнатуры означает
miss. После холодного чтения выполняется повторный `stat`; если файл изменился
во время вычисления, результат не публикуется и запрос fail-dark либо делает не
более одной повторной стабильной попытки. Бесконечного retry нет.

### 9.2. Стоимость и память

- Blob читается фиксированными chunks; полные bytes не сохраняются в памяти.
- Неизменившаяся файловая версия хешируется один раз на жизнь cache независимо
  от того, пришёл первый запрос через WS или HTTP.
- Одновременные проверки одного key/signature выполняют ровно одно чтение;
  остальные ждут тот же результат. Ошибка также будит ожидающих и не оставляет
  key навсегда in-flight.
- Разные файлы не обязаны выполняться последовательно; реализация не должна
  держать один глобальный lock на протяжении всех чтений.
- Cache ограничен не более чем 256 entries и вытесняет least-recently-used либо
  эквивалентно детерминированный старый entry.
- Cached digest/negative integrity result применим только к той же сигнатуре.
  Missing path не кешируется бессрочно без файловой сигнатуры.
- Cache memory-only, не входит в config/diagnostics/export/backup и очищается при
  перезапуске HA. Persisted invalidation или миграция не нужны.

### 9.3. Прямой metadata lookup

Resolve не вызывает полный `read_catalog(root)`. Для каждого уникального
разрешённого id читается только `<asset_id>.json`; запись проходит те же проверки
формы, extension, id и наличия blob, что каталог. Shared helper обязан оставлять
`assets/list` и resolve согласованными, чтобы две копии validation не разошлись.

## 10. Ошибки и совместимость

- Public success payload `{assets, missing}` и metadata row не меняются.
- `not_ready` — единственная новая наблюдаемая ошибка для вызова в момент, когда
  config entry не загружена; это тот же lifecycle-контракт остальных WS-команд.
- Read-only forbidden id становится `missing`, не `unauthorized`.
- I/O/JSON/stat/hash failures не содержат disk path или exception в ответе.
- Existing valid configs, exports/imports и image records читаются без миграции.
- Новый frontend со старым backend и старый frontend с новым backend продолжают
  работать в пределах контракта #51; capability version не повышается.

## 11. UX, accessibility, touch и i18n

Новых контролов, текстов, focus/keyboard semantics и переводов нет. Full card и
space card рисуют тот же image либо существующий missing-placeholder. View,
kiosk, phone и tablet обязаны сохранить parity для read-only user; редакторы
остаются доступны только по действующему `can_write`.

Golden и browser smoke не требуются: рендер и frontend не меняются. Read-only
View доказывается backend permission-контрактом плюс существующими frontend
unit tests вызова resolve; код-ревью отдельно проверяет, что frontend не получил
writer-only зависимость.

## 12. Затронутые модули

Ожидаемый набор; имена нового helper могут быть уточнены без изменения
контракта:

- `custom_components/houseplan/decor_assets.py` либо новый чистый модуль рядом —
  direct metadata lookup и bounded single-flight integrity cache;
- `custom_components/houseplan/websocket_api.py` — runtime/access filter и
  использование общего verifier;
- `custom_components/houseplan/http_api.py` — тот же verifier перед asset
  `FileResponse`;
- `custom_components/houseplan/__init__.py` / runtime helper — один cache на HA
  instance с корректным lifecycle;
- `tests_backend/test_decor_assets.py` — чистые cache/direct-lookup тесты;
- `tests_backend/test_ha_websocket.py` — HA permission, WS/HTTP и shared-cache
  integration tests;
- `scripts/mutation-gate.mjs` — постоянные отрицательные свидетели;
- `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`, changelog RU/EN.

`src/**`, frontend bundle и i18n не должны меняться, если реализация не обнаружит
отдельный, заранее согласованный compatibility blocker.

## 13. Критерии приёмки

- **AC1 (backend/HA).** При `admin_only: true` read-only user успешно разрешает
  сохранённый referenced asset; full и space View не получают writer-only
  зависимости.
- **AC2 (backend/HA, security).** Тот же user получает unreferenced id в
  `missing`, тогда как referenced id из той же пачки остаётся в `assets`;
  metadata/stat/blob запрещённого id не читаются. Writer разрешает оба, а при
  `admin_only: false` обычный authenticated user имеет writer-контракт.
- **AC3 (backend/HA, lifecycle).** Без loaded runtime resolve отвечает
  `not_ready` до любых filesystem operations.
- **AC4 (backend/unit).** Resolve читает metadata только уникальных разрешённых
  requested ids и не сканирует остальные catalog rows; malformed/mismatched row
  fail-dark и согласована с `read_catalog()`.
- **AC5 (backend/HA, performance).** Последовательные WS resolve и HTTP GET
  одного неизменившегося valid blob в любом порядке вызывают одно потоковое
  вычисление SHA-256 на общую файловую версию.
- **AC6 (backend/unit, performance).** N параллельных проверок одного
  path/signature выполняют один loader/hash, получают одинаковый результат и не
  оставляют in-flight state после success или exception. Проверки разных paths
  могут продвигаться независимо.
- **AC7 (backend/unit/HA, integrity).** Изменение signature инвалидирует hit;
  заменённый corrupt blob становится `missing` в WS и 404 в HTTP. Смена файла во
  время чтения не кеширует неподтверждённый digest. Повторный запрос той же
  corrupt signature не перечитывает blob.
- **AC8 (backend/unit, budget).** Cache хранит не более 256 entries, вытесняет
  старые, не хранит bytes и вычисляет digest chunks без `Path.read_bytes()`.
- **AC9 (backend/HA, compatibility).** Authenticated и signed valid GET сохраняют
  body, MIME/security/cache headers и streaming `FileResponse`; plans/files
  остаются вне нового verifier.
- **AC10 (review/docs).** Payload, capability, config schema, imports/exports,
  frontend, i18n и URL не меняются; architecture/compatibility docs и оба
  changelog описывают новый access/cost contract.
- **AC11 (mutation gate).** Для дорогих защит зарегистрированы и исполнены
  постоянные свидетели: снятие read-only membership filter краснит AC2; отключение
  cache hit/single-flight краснит AC5/AC6; принятие digest после смены signature
  краснит AC7. Штатное дерево проходит те же guards зелёным.

## 14. Таблица защитных доказательств

Эта таблица обязательна для handoff и code-review по правилу #435; точные имена
могут быть уточнены, но третий столбец не может исчезнуть.

| AC | Чем доказан | Чем обязан покраснеть |
|---|---|---|
| AC2 | HA test `test_decor_asset_resolve_readonly_is_limited_to_referenced_ids` | мутант удаляет membership filter до metadata lookup; unreferenced id появляется в `assets` либо вызывает I/O |
| AC3 | HA test `test_decor_asset_resolve_requires_runtime_before_io` | мутант удаляет `_runtime()`/ранний return; filesystem probe фиксирует обращение |
| AC4 | pure/HA test direct lookup со сторонними catalog rows | мутант возвращает `read_catalog(root)`; sentinel metadata вне request читается |
| AC5 | HA test WS → HTTP и HTTP → WS с hash counter | мутант всегда объявляет cache miss; counter становится больше 1 |
| AC6 | pure threaded single-flight test с управляемым barrier/loader | мутант удаляет in-flight coordination; loader вызывается N раз |
| AC7 | pure + HA test смены signature и mid-read mutation | мутант игнорирует signature/post-read stat; старый/нестабильный digest принимается |
| AC8 | pure LRU/chunk-reader tests | мутант снимает eviction либо заменяет chunk loop на `read_bytes()`; size/reader sentinel нарушается |
| AC9 | существующий и расширенный signed-content HA test | мутант обходит verifier для HTTP либо меняет headers/FileResponse; corrupt body отдаётся или contract assertions падают |

AC2/AC5/AC6/AC7, которые зависят от HA либо concurrency и не гарантированно
воспроизводятся локально у ревьюера, получают persistent entries в
`scripts/mutation-gate.mjs`. Для чистого AC8 допустим адресный red proof с
выводом в документе ревью.

## 15. План автотестов

1. Расширить #51 HA fixture двумя assets: один referenced, второй нет; выполнить
   resolve read-only и writer connections при обоих значениях `admin_only`.
2. Подменить direct metadata/stat/hash seams счётчиками и доказать, что forbidden
   id не достигает файловой системы, а unrelated catalog row не сканируется.
3. Вызвать handler без runtime и проверить `not_ready` + нулевые I/O counters.
4. Чисто протестировать hit/miss, LRU boundary 256/257, changed size/timestamps,
   cached corrupt digest и bounded retry при изменении во время чтения.
5. Через управляемые threads/barriers одновременно проверить один и разные keys;
   тест не использует sleep и имеет bounded join/timeout только как защиту от
   deadlock.
6. В HA test последовательно вызвать WS и signed HTTP (затем обратный порядок)
   и проверить единый hash counter, 200/404 и неизменные headers/body.
7. Запустить каждый mutation witness: исправное дерево зелёное, мутированное
   падает именно целевым assertion, а не import/timeout ошибкой.
8. Implementation gate: `npm run typecheck`, `npm test`, `npm run build`;
   backend HA-harness — Linux CI. Browser/golden/performance smoke не выбираются,
   если `smoke-select` не обнаружит расширение frontend/visible surface.

## 16. Производительность и безопасность

- Повторный неизменившийся blob: 0 прочитанных content bytes для hash; допустим
  один `stat` и bounded cache lookup.
- Холодный blob: не более его фактического размера, читаемого chunks; параллельные
  запросы одной версии не умножают bytes.
- Память cache: O(256) metadata/digests/in-flight records, без blob bytes.
- Resolve I/O: O(число уникальных разрешённых requested ids), а не O(весь каталог).
- Read-only user не получает metadata unreferenced asset и не может заставить
  verifier прочитать его через WS resolve.
- Секреты, локальные пути и причины fail-dark не входят в transport response.

## 17. Риски

- **Stale cache скроет повреждение.** Смягчение: precise signature до hit и
  повторный stat после чтения; AC7 с отрицательным witness.
- **Single-flight deadlock после исключения.** Смягчение: cleanup/notify в
  `finally`, детерминированный concurrent error test.
- **Глобальный lock сериализует разные images.** Смягчение: in-flight ownership
  по key, AC6 отдельно запускает два paths.
- **Read-only View случайно станет writer-only.** Смягчение: referenced success
  закреплён AC1 для обеих карточек как blocking compatibility invariant.
- **Partial batch выдаст existence oracle.** Смягчение: forbidden id неотличим от
  missing/corrupt и не отменяет разрешённые rows.
- **Config меняется между auth snapshot и resolve.** Смягчение: snapshot короткий,
  file deletion по inference запрещено, следующий load пересинхронизирует View.

## 18. Откат

Откат — revert backend helper и его вызовов, возврат прежних resolve/GET путей.
Persisted state, config, assets и migration rollback отсутствуют. Security и
performance защиты не имеют runtime-флага: временное отключение cache не должно
молча отключать membership guard или integrity check.

## 19. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: кратко описать сохранение
  read-only View и устранение повторного хеширования (`User-Visible: yes`);
- `docs/ARCHITECTURE.md`: access matrix resolve/GET и shared verifier lifecycle;
- `docs/CONFIG-COMPATIBILITY.md`: отсутствие schema/capability migration и
  rolling compatibility;
- `scripts/mutation-gate.mjs`: security/performance/integrity witnesses;
- user guide, i18n, screenshots/golden: без изменений;
- handoff содержит точный SHA, HA test names, hash/I/O counters и результаты
  каждого отрицательного witness.

## 20. Принятые технические предположения

- Forbidden read-only id возвращается как `missing`, а не ошибкой всего вызова:
  это сохраняет partial batching и не раскрывает существование файла.
- Cache принадлежит HA instance и лениво доступен обоим endpoint; конкретное
  место хранения (`hass.data` либо эквивалентный runtime service) не является
  persisted контрактом.
- Лимит cache 256 покрывает максимальные 200 promoted assets с небольшим
  служебным запасом и остаётся явной тестируемой константой.
- Exact cache signature включает `ctime_ns` сверх предложенных issue
  path/mtime/size: это усиливает invalidation без изменения пользовательского
  контракта.
- Ссылки на строки ориентировочны; реализация привязывается к символам и
  поведению, если `dev` сдвинется до начала разработки.
