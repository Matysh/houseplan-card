# ТЗ #434 — Полиш аудита v1.71.0-beta.1

- Issue: https://github.com/Matysh/houseplan-card/issues/434
- Приоритет: P3, `bug` / `polish` / `tests`
- Маршрут: full; задача меняет Python- и TypeScript-продукт, хранение
  пользовательских файлов, rolling compatibility, асинхронный safety lifecycle
  и несколько независимых гейтов, поэтому не проходит лимит сложности и одной
  поверхности лёгкого трека
- Связанные контракты: #51 (пользовательские изображения), #417 (ветви
  подтверждения опасных действий), #418/#423 (support preview), #419 (Area
  snapshot cleanup), #432 (resolve и целостность assets)

## Сценарий

Home admin пользуется изображениями в Редакторе подложки и отдельной карточкой
пространства, обновляет frontend и интеграцию через HACS, меняет язык либо
отправляет обращение в поддержку. В редком аварийном состоянии Home Assistant
может остановиться между записью blob и sidecar. Одновременно разработчик
рассчитывает, что защитные тесты действительно краснеют при снятии проверок, а
один зависший browser smoke не удерживает весь CI job до глобального timeout.

## Что человек увидит до и после

**До:** аварийно оставшийся файл изображения не входит в лимит и не удаляется
явным API-вызовом, повторная загрузка неверно выглядит как переиспользование;
static card шумит ошибкой на старом backend, а восстановленное изображение может
остаться `missing` до переподключения. В переходе языка подтверждение опасного
действия может зависнуть или быть ошибочно отклонено, а невалидный ответ support
preview удерживает временный слот десять минут.

**После:** физический store честно учитывает аварийные blobs, повторная загрузка
безопасно восстанавливает каталог, явное удаление действительно удаляет точный
asset; обе карточки соблюдают capability и revision cache. Подтверждение всегда
либо показано, либо немедленно и безопасно отменено, а неиспользованный support
token отзывается. Видимые контролы, тексты и обычные успешные сценарии не
меняются.

## Цель

Закрыть девять подтверждённых разрывов аудита v1.71.0-beta.1 и закрепить для
каждой защитной ветки отрицательный свидетель:

1. физический учёт и явное удаление orphan decor blobs;
2. capability guard в `houseplan-space-card`;
3. cache epoch resolve по ревизии config;
4. точный тест наличия blob для catalog row;
5. честный `reused` при восстановлении sidecar;
6. актуальный locale gate и симметричная отмена danger confirmation;
7. свидетель принадлежности кандидата текущему Area snapshot;
8. локальные timeout для German wait и каждого CI smoke-файла;
9. отзыв валидного support token из непринятого ответа.

## Подтверждённые причины

1. `read_catalog()` обходит только `*.json`, а `_read_catalog_row()` принимает
   строку лишь при существующем blob. Поэтому blob без корректного sidecar не
   виден ни каталогу, ни quota, а delete сначала ищет ту же невидимую строку.
2. `HpConfigSnapshot` не переносит `decor_assets_api`, и `_load()` static card
   безусловно вызывает `houseplan/assets/resolve`.
3. `resolveCache` хранит одну пару `набор id → Map` на connection и не включает
   принятую серверную ревизию config; `missing` тем самым становится бессрочным
   для прежнего набора id.
4. Тест с названием `test_catalog_ignores_missing_or_malformed_sidecars`
   создаёт blob для единственной валидной строки и не проверяет обратный случай
   «валидный sidecar, blob отсутствует».
5. Upload при уже существующем exact blob дописывает sidecar и возвращает
   `reused: true`, хотя до операции promoted catalog entry не существовала.
6. `_confirmDanger()` читает `_dangerConfirmLocaleGate` прошлого render. Между
   изменением языка и render это даёт ложное разрешение, а между завершением
   загрузки языка и render — ложный отказ. Переход в `warm/noChange` не отменяет
   уже открытый controller request и оставляет его в inert DOM.
7. Условие `snapshotBindings.has(binding)` в `resolveAreaSnapshotCleanup()` не
   имеет кейса, в котором все соседние проверки истинны, а binding отсутствует
   только в текущем snapshot.
8. `germanStarted` ограничен одной секундой, соседний `germanCompleted` ожидается
   без границы; CI запускает каждый `demo/smoke_*.mjs` простым `node`, поэтому
   отдельный файл ограничивает лишь 20-минутный timeout всей job.
9. `_buildSupportPreview()` извлекает token, но при невалидности другого поля
   бросает `support_rejected` до `_discardSupportPreview()`.

## Скоуп

В скоупе:

- независимый физический inventory promoted decor blobs для quota/delete;
- восстановление missing/broken sidecar повторной exact загрузкой;
- точная семантика `reused` для valid catalog hit и repaired orphan;
- передача runtime capability в shared config snapshot и fail-closed guard
  static card;
- revision-scoped positive/negative resolve cache в full и static card;
- актуальная проверка locale readiness при каждом danger request и отмена
  открытого request при переходе в неотрисовываемый `warm`;
- недостающие unit/backend/smoke cases и постоянные mutation witnesses;
- bounded ожидание German route и per-file timeout smoke-шарда в Validate;
- best-effort discard каждого корректного support token, ответ которого не был
  принят в состояние диалога;
- техническая документация и оба changelog.

## Не-скоуп

- palette/файловый менеджер для отображения orphan blobs, автоматическая сборка
  мусора, age-based cleanup либо удаление по отсутствию ссылки;
- восстановление metadata без повторной загрузки exact canonical bytes;
- новый формат sidecar, asset id, URL, capability version, quota либо config;
- повышение `decor_assets_api`, support protocol или export format;
- изменение разрешений list/resolve/upload/delete и content GET;
- изменение визуала decor image, static card, danger dialog или support form;
- новое пользовательское сообщение о repaired orphan либо о техническом
  discard;
- изменение двухподтверждённого Area-cleanup контракта #419;
- полный рефакторинг LanguageRuntime, support pipeline или smoke sharding.

## Контракт поведения

### 1. Physical inventory и quota

Promoted blob — обычный файл в decor-assets root с точным именем
`<64 lowercase hex><allowed extension>`, где extension входит в действующий
allowlist PNG/JPEG/WebP/SVG. Temporary `.asset-*`, sidecars, каталоги, prefix-
совпадения и неизвестные расширения не являются promoted blobs.

Quota до создания нового blob считается по физическому inventory, а не по
доверенным sidecar rows:

- file count — число promoted blob-файлов;
- bytes — сумма их фактических `stat().st_size`;
- blob учитывается даже при отсутствующем, битом, несовпавшем либо лживом
  sidecar и даже при неверном digest содержимого;
- отсутствующий blob при сохранившемся sidecar не занимает file/byte quota;
- каждый реально лежащий allowed-extension файл учитывается один раз; возможные
  несколько расширений одного hash — несколько физических файлов.

Catalog/list/resolve при этом не становятся менее строгими: без корректного
sidecar и существующего совпадающего blob orphan остаётся невидимым и не
рендерится. Это разделяет доверенный каталог и физическое потребление диска.

### 2. Upload recovery и `reused`

Под `upload_lock` backend до отказа по count/byte quota проверяет точный путь
`<validated asset_id><validated extension>`:

- valid catalog row + подтвердившийся exact blob сохраняет прежний idempotent
  результат `reused: true` и не меняет имя/created_at;
- exact blob без принимаемого catalog row хешируется и сравнивается с id;
  совпадение атомарно создаёт новый sidecar из текущей validated загрузки и
  возвращает `reused: false`, потому что promoted catalog entry создана этой
  операцией;
- recovery не требует свободного file slot/bytes: физический blob уже вошёл в
  inventory и новых promoted bytes операция не добавляет;
- несовпавший digest не перезаписывается и не удаляется по предположению;
  upload fail-closed возвращает действующую безопасную ошибку целостности;
- broken/mismatched sidecar заменяется только при exact hash match того же id;
  ни один другой blob/sidecar не затрагивается.

Обычная новая загрузка после recovery check применяет прежние 200 assets /
256 МиБ / low-disk границы и атомарную запись. Ошибка не оставляет новый blob,
sidecar или temporary.

### 3. Явное удаление orphan

`houseplan/assets/delete` по-прежнему требует write permission, корректный exact
asset id и нулевой authoritative refcount под `write_lock + upload_lock`.
Успешно проверенный явный запрос удаляет:

- `<asset_id>.json`, если он существует независимо от валидности;
- каждый обычный файл `<asset_id><allowed extension>` из фиксированного
  allowlist.

Он не использует пользовательскую строку как glob, не удаляет directories,
temporary, неизвестные расширения или prefix-совпадения. `removed: true`, если
удалён хотя бы один exact sidecar/blob; `false`, если ни одного target не было.
Ошибка `in_use` ничего не удаляет, даже если sidecar повреждён. Это не нарушает
standing rule: причиной удаления является явное действие с точным asset id, а
не вывод из отсутствия ссылок.

### 4. Capability static card и resolve cache

`HpConfigSnapshot` получает runtime-only нормализованное поле capability. Только
exact safe integer `decor_assets_api === 1` означает поддержку; отсутствующее,
нецелое, иное либо malformed значение становится `null`. Каждый успешный fresh
`config/get` авторитетен и может отозвать ранее принятую capability даже при
неизменном config fingerprint. LocalStorage snapshot capability не доверяет и
не превращает в persisted permission: до свежего ответа значение `null`.

`houseplan-space-card`:

- при exact capability вызывает resolve и рисует разрешённые assets;
- без неё не вызывает `houseplan/assets/resolve`, очищает runtime map assets и
  использует прежнее fail-closed missing-поведение;
- принимает capability-only изменение snapshot даже при неизменных config,
  layout и virtual-light fingerprints;
- не показывает toast/raw WS error и не добавляет новый UI.

`resolveDecorAssets()` получает обязательный opaque config epoch от вызывающей
карточки. Для серверного snapshot epoch включает как минимум принятую числовую
ревизию; full и static card передают ревизию одного и того же accepted config.
Cache key равен `owner connection + epoch + sorted unique valid ids`:

- одинаковые owner/epoch/id-set возвращают тот же `Map` без нового WS;
- новый epoch вызывает новый resolve даже при том же id-set, включая повторную
  проверку прежних `missing`;
- разные owner не делят cache;
- failed call не кэшируется;
- batching 200 и validation ответа не меняются.

### 5. Danger confirmation и текущий язык

Решение о возможности открыть `hp-confirm` принимается по текущей конфигурации
языка и текущему состоянию `LANGUAGE_RUNTIME` в момент request/update, а не по
полю, записанному предыдущим render.

- Если текущая ветка `warm → noChange` не может добавить confirmation, новый
  `_confirmDanger()` сразу возвращает `false`, ничего не регистрирует в
  controller и не ждёт следующего render.
- Если язык уже перешёл из pending в ready/fallback до render, новый request не
  получает ложный отказ из-за прошлого `warm` и проходит обычный путь.
- Уже открытый request при переходе в `warm` разрешается `false` до потери
  decision source. `hp-confirm` перестаёт быть действующим/доступным элементом,
  тогда как последний стабильный body сохраняется по семантике `noChange`, а
  host остаётся `inert` до готовности локали.
- Onboarding, fixed-floor pending/invalid, lost-space guard, cold first-load и
  ready main branch сохраняют контракт #402/#417; количество подтверждений —
  не более одного, согласие никогда не переносится между языковыми состояниями.

### 6. Area snapshot negative witness

Поведение #419 не меняется. Previous cleanup candidate переносится в следующий
проход только если его binding одновременно валиден, revision конечна и binding
присутствует в текущем `marker_area_snapshot`. Тест создаёт случай, где первые
два условия истинны, registries допустимы, но snapshot binding отсутствует;
кандидат обязан исчезнуть. Отдельная мутация снятия membership-check обязана
покраснеть именно на этом assertion.

### 7. Bounded smoke execution

- И `germanStarted`, и `germanCompleted` в
  `demo/smoke_danger_confirm_branches.mjs` ожидаются через локальную границу
  1000 мс с разными диагностическими ошибками. Отсутствие completion не может
  превратить целевой smoke в бесконечное ожидание.
- Validate smoke shard запускает каждый `demo/smoke_*.mjs` через GNU
  `timeout --kill-after=10s 180s`. Exit 124 считается обычным падением файла,
  его лог печатается и остальные назначенные shard-файлы продолжают выполняться;
  итог shard остаётся красным.
- Глобальный `timeout-minutes: 20`, детерминированное разбиение, browser install,
  exception guard и log artifacts не меняются.

### 8. Support preview token cleanup

Любой ответ `houseplan/support/preview`, содержащий token формы ровно 48
lowercase hex, владеет временным backend slot. Если frontend не принимает этот
ответ как текущий valid preview по любой причине, token best-effort отзывается
ровно один раз через `houseplan/support/preview/discard`:

- malformed hash/format/version/size/spaces/expires/text при валидном token;
- ответ устаревшего generation/draft либо снятого consent;
- отказ применить уже проверенный preview в текущее состояние.

Malformed/отсутствующий token не отправляется в discard. Cleanup выполняется
независимо от того, актуален ли уже UI request; только изменение видимого error
state зависит от current generation. Ошибка discard не маскирует исходный
`support_rejected`, не раскрывается пользователю и оставляет backend TTL
последней защитой. Valid current preview, успешный submit и уже существующие
close/uncheck paths не получают лишнего discard.

## Модель данных, API и совместимость

- Persisted config/layout, model version, sidecar schema, asset id, export/import
  и support package не меняются; миграции нет.
- `decor_assets_api: 1` уже существует в `config/get`; меняется только перенос
  и потребление существующей runtime capability в shared snapshot.
- Новых WebSocket/HTTP endpoint и полей response нет. Уточняется смысл
  существующего upload `reused`: `true` означает, что valid catalog entry уже
  существовала до запроса; repaired orphan возвращает `false`.
- Старый frontend игнорирует additive backend поведение. Новый frontend со
  старым backend fail-closed не вызывает неизвестный asset resolve из static
  card и продолжает рисовать остальные слои.
- Orphan inventory вычисляется с диска и нигде не сохраняется. Repair sidecar
  использует действующую schema; downgrade не требует rollback данных.

## UX, accessibility, touch, kiosk и i18n

- Новых кнопок, сообщений, focus targets, жестов, ARIA и переводов нет.
- Full View, static View, kiosk, desktop и touch получают один capability/cache
  контракт; редактор остаётся desktop-first.
- При несовместимом backend static card просто не рисует недоступное custom
  image, как для `missing`; остальные стены, комнаты, устройства и decor
  остаются видимы.
- Danger confirmation сохраняет прежний текст, focus и alertdialog semantics;
  изменение только исключает зависший/устаревший dialog во время смены языка.
- Support form сохраняет текущую ошибку `support_rejected`; cleanup не добавляет
  новый status либо toast.
- Golden не требуется: ожидаемый визуальный кадр в устойчивых состояниях не
  меняется. Docs screenshots должны подтвердить нулевую pixel-дельту; при
  изменении `src/**` обновляется их source fingerprint по штатному workflow.

## Производительность, хранение и безопасность

- Quota inventory — один bounded scan директории под уже существующим
  `upload_lock` на upload; `assets/list/resolve` не получают дополнительный
  полный scan. Стоимость O(число entries в asset root), физически ограниченном
  quota 200 promoted blobs плюс служебные файлы.
- Повторный resolve в рамках одного config epoch остаётся O(1) cache hit; новый
  epoch делает не более одного batched WS-прохода на exact id-set.
- Capability guard убирает заведомо отклоняемый WS-вызов на старом backend.
- Per-file timeout ограничивает один smoke 180 секундами и не уменьшает
  20-минутный общий бюджет job.
- Quota не доверяет sidecar bytes/count, delete не использует glob и всегда
  повторно проверяет refs/permission. Digest-mismatch никогда не перезаписывается
  автоматически.
- Support discard принимает только уже выданный token строгой формы и не
  добавляет данные к package/relay. Ошибка cleanup не раскрывает token, path или
  backend exception.

## Затронутые модули

Ожидаемый набор; выделение чистых helpers допустимо без изменения контракта:

- `custom_components/houseplan/decor_assets.py` — physical inventory/catalog
  seams;
- `custom_components/houseplan/http_api.py` — quota и orphan upload recovery;
- `custom_components/houseplan/websocket_api.py` — exact orphan delete;
- `src/config-store.ts`, `src/space-card.ts`, `src/houseplan-card.ts`,
  `src/decor-assets.ts` — capability, epoch cache и danger lifecycle;
- `src/houseplan-editor-runtime.ts` — support token cleanup;
- `src/device-area-relocation.ts` меняется только если потребуется тестируемый
  seam; сам контракт cleanup не меняется;
- `test/decor-assets.test.mjs`, `test/device-area-relocation.test.mjs`, новый
  либо существующий config/static-card contract test;
- `tests_backend/test_decor_assets.py`, `tests_backend/test_ha_websocket.py` —
  inventory/upload/delete cases;
- `demo/smoke_danger_confirm_branches.mjs`,
  `demo/smoke_support_feedback.mjs` — transition/cleanup integration;
- `.github/workflows/validate.yml`, workflow contract test,
  `scripts/mutation-gate.mjs` — timeouts и постоянные свидетели;
- `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`, `docs/TESTING.md`,
  `docs/SUPPORT-PRIVACY.md`, оба changelog и docs screenshot fingerprint.

## Критерии приёмки

- **AC1 (backend/unit, storage).** Blob без sidecar и blob с malformed/
  mismatched sidecar отсутствуют в catalog/list/resolve, но каждый входит в
  physical count и actual-byte quota; sidecar без blob не входит в catalog и не
  расходует blob quota. **Доказательство:** pure backend matrix с границами
  count/bytes ±1.
- **AC2 (backend/HA, recovery).** Exact повторная загрузка valid orphan до
  проверки новой quota атомарно создаёт sidecar, возвращает `reused:false` и
  делает asset доступным list/resolve; последующая identical upload возвращает
  `reused:true`. Digest mismatch не меняет ни один файл.
  **Доказательство:** upload endpoint test с full-quota fixture и hash asserts.
- **AC3 (backend/HA, explicit delete).** Writer удаляет unreferenced exact
  blobs всех allowed extensions и sidecar даже при missing/broken metadata;
  `removed` отражает наличие удалённого target. `in_use`, prefix, unknown ext,
  temp и directory остаются нетронутыми. **Доказательство:** WebSocket access /
  filesystem matrix.
- **AC4 (backend/unit, regression).** Valid-shaped sidecar без matching blob
  отбрасывается общим catalog/direct-read validator; снятие `blob.is_file()`
  краснит точный тест. **Доказательство:** расширенный
  `test_catalog_ignores_missing_or_malformed_sidecars` + mutation gate.
- **AC5 (unit/smoke, compatibility).** Fresh shared snapshot нормализует exact
  capability, localStorage seed имеет `null`; static card не вызывает resolve
  без exact v1, очищает asset map при downgrade и вызывает resolve после
  capability-only upgrade при том же config. **Доказательство:** shared-store
  unit + static-card network-counter smoke/contract.
- **AC6 (unit, performance).** Одинаковые owner/epoch/sorted-id-set дают один
  resolve и один `Map`; при следующем config epoch тот же положительный либо
  negative-cached set вызывает новый resolve. Failed call не кэшируется,
  batching остаётся 200. **Доказательство:** `decor-assets` call-count matrix.
- **AC7 (browser smoke, safety).** В обоих окнах ready→warm и warm→ready новый
  danger request принимает решение по текущему runtime; уже открытый dialog при
  переходе в warm резолвится `false`, исчезает как действующий decision source,
  controller пуст, stable body не заменён, host inert. Остальные ветви #417
  остаются зелёными. **Доказательство:** расширенный branch smoke с bounded
  promise races и двумя отдельными mutants.
- **AC8 (unit, regression).** Previous Area cleanup candidate, отсутствующий в
  текущем snapshot, не переносится при otherwise-valid данных; снятие
  `snapshotBindings.has(binding)` краснит только этот кейс.
  **Доказательство:** targeted unit + mutation gate.
- **AC9 (unit/CI contract, liveness).** `germanCompleted` падает с собственной
  диагностикой не позднее 1000 мс; каждый CI smoke имеет 180-секундный TERM и
  10-секундный KILL guard, timeout помечает shard красным, сохраняет лог и не
  пропускает последующие файлы. **Доказательство:** completion-timeout probe +
  workflow unit с мутированным отсутствующим wrapper.
- **AC10 (browser smoke, privacy/lifecycle).** Valid token из invalid, stale или
  неприменённого preview response отзывается ровно один раз; malformed token не
  отзывается; current valid preview и success не получают преждевременный
  discard. UI сохраняет исходный error/current draft. **Доказательство:**
  support smoke с WS call counters + mutation gate.
- **AC11 (review/docs, compatibility).** Нет schema/API version/i18n/visual
  изменений; standing no-inference deletion, write/ref guards и partial asset
  resolve сохранены. Architecture/compatibility/testing/privacy docs и оба
  changelog согласованы. **Доказательство:** diff review, docs checks и
  compatibility fixtures.
- **AC12 (gates).** Typecheck, unit, build/bundle sync, selected frontend
  smokes, backend tests, no-new-any, docs, workflow contracts и все новые
  mutation witnesses зелёные на exact SHA. Golden и full performance остаются
  предрелизными, Linux CI — канон полного HA harness.

## Таблица защитных доказательств

Точные имена тестов можно уточнить при реализации, но каждая строка сохраняет
отдельный отрицательный witness по правилу #435.

| AC | Чем доказан | Чем обязан покраснеть |
|---|---|---|
| AC1 | backend quota/catalog matrix | inventory снова строится из `read_catalog()` либо доверяет sidecar bytes; orphan не меняет count/bytes и boundary upload ложно проходит |
| AC2 | HA upload recovery test | recovery выполняется после quota либо возвращает `reused:true`; full-quota repair отказывается или assertion response падает |
| AC3 | HA delete filesystem matrix | delete снова зависит только от valid catalog row либо удаляет glob/prefix; orphan остаётся или sentinel исчезает |
| AC4 | exact sidecar-without-blob test | mutation удаляет `blob.is_file()`; missing blob появляется в catalog |
| AC5 | config-store/static-card call counters | mutation удаляет exact capability guard/revocation; старый backend получает resolve либо downgrade сохраняет map |
| AC6 | resolve cache call-count unit | mutation удаляет epoch из key; второй epoch не делает WS и прежний missing остаётся |
| AC7 | danger branch smoke | mutations возвращают cached render gate либо удаляют warm-transition cancel; promise зависает/ложно отклоняется или controller/DOM остаётся действующим |
| AC8 | Area cleanup targeted unit | mutation удаляет `snapshotBindings.has(binding)`; отсутствующий binding переносится |
| AC9 | timeout probe + workflow contract | mutation делает plain `await germanCompleted` либо plain `node "$f"`; probe превышает границу или contract assertion не находит timeout wrapper |
| AC10 | support smoke с exact discard counters | mutation переставляет validation throw до cleanup/удаляет cleanup; token не отзывается либо отзывается дважды |

Для AC1–AC4/AC7/AC8/AC10, где полный backend/browser прогон дорог для ручного
повтора, добавляются persistent entries в `scripts/mutation-gate.mjs`. Для AC5,
AC6 и workflow contract допустим адресный unit red-run, если его команда и вывод
внесены в code-review; пустого третьего столбца быть не может.

## План автотестов

1. Создать backend filesystem matrix: valid row, missing blob, missing sidecar,
   malformed/mismatched sidecar, wrong digest, duplicate allowed extensions,
   unknown extension, temp и directory; независимо проверить trusted catalog и
   physical inventory.
2. На count и byte limit проверить обычный отказ, exact orphan repair при уже
   полном store и честную последовательность `false → true` для `reused`.
3. Через HA WebSocket проверить delete для orphan/broken/valid metadata, writer/
   read-only, in-use race и sentinels, которые не совпадают exact id+allowlist.
4. Расширить `decor-assets` unit матрицей owner × epoch × id order × missing ×
   rejected call × 200/201 ids.
5. Проверить shared snapshot для fresh exact/missing/malformed capability,
   localStorage seed и capability-only upgrade/downgrade без смены config body.
6. В danger branch smoke удерживать locale request: отдельно открыть request до
   warm transition, вызвать request до следующего render после смены языка и
   завершить locale до следующего render. Все ожидания имеют локальный timeout.
7. Добавить exact Area candidate кейс и выполнить его с удалённым membership
   condition.
8. Добавить German completion timeout probe и статический workflow contract;
   timeout fixture обязан оставить следующий synthetic command выполненным, но
   итоговый status — failure.
9. В support smoke вернуть ответы с valid token и отдельно испорченными hash,
   format, size и current generation; посчитать discard по каждому token.
10. Запустить штатное дерево и каждый mutation witness: падение должно происходить
    по целевому assertion, а не по parse/import/внешнему глобальному timeout.

## Риски

- **Физический scan примет посторонний файл за asset.** Смягчение: exact hash
  filename + фиксированный allowlist; это консервативно для quota, но никогда не
  делает файл доверенным catalog asset.
- **Recovery перезапишет чужие bytes.** Смягчение: exact path и полный SHA-256;
  mismatch только отказывает и требует явного delete.
- **Delete расширит область удаления.** Смягчение: fixed paths из allowlist,
  no glob, permission/ref locks и sentinel tests.
- **Capability-only snapshot потеряется из-за fingerprint optimization.**
  Смягчение: capability включена в adoption decision и имеет отдельный тест без
  config/layout delta.
- **Danger fix нарушит `noChange` и мигнёт stable body.** Смягчение: smoke
  сравнивает body identity/содержимое отдельно от удаляемого confirm outlet.
- **Per-file timeout окажется слишком коротким на cold runner.** Смягчение:
  180 секунд значительно выше обычного отдельного smoke и сохраняет глобальные
  20 минут; timeout печатает точное имя и лог для пересмотра числа.
- **Best-effort discard сам упадёт.** Смягчение: исходная ошибка остаётся
  основной, TTL backend сохраняется как финальная защита.

## Откат

Откат — единый revert implementation commit. Persisted schema и migration
отсутствуют. Уже восстановленные valid sidecars остаются обычными корректными
catalog rows и безопасны для старой версии. Возврат старой quota/cache/confirm/
cleanup логики допустим только вместе с возвратом соответствующих тестов и
changelog; пользовательские blobs при откате автоматически не удаляются.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: orphan recovery/quota/delete,
  static capability/cache retry и безопасные async cleanup fixes;
- `docs/ARCHITECTURE.md`: trusted catalog против physical inventory и asset
  recovery/delete boundaries;
- `docs/CONFIG-COMPATIBILITY.md`: runtime-only capability static card и cache
  epoch без повышения API;
- `docs/TESTING.md`: 180-секундный per-smoke guard и negative witness policy;
- `docs/SUPPORT-PRIVACY.md`: token из непринятого ответа также отзывается;
- `scripts/mutation-gate.mjs`: постоянные backend/browser witnesses;
- docs screenshot workflow: подтверждение нулевой pixel-дельты и обновлённый
  fingerprint из-за `src/**`;
- i18n, user guide, golden baselines и performance profiles: без изменений;
- implementation commit — `User-Visible: yes`, оба changelog в том же коммите.

## Принятые технические предположения

Эти решения не меняют продуктовый замысел и могут быть свободно скорректированы
ревьюером до S5:

- orphan остаётся невидимым в palette до exact повторной загрузки: без sidecar
  нельзя достоверно показать имя, MIME и размеры;
- quota считает фактические allowed-extension files, а не уникальные hash:
  каждое физическое потребление диска должно быть ограничено;
- broken sidecar repair получает metadata/имя/created_at текущей загрузки и
  `reused:false`; прежним недоверенным полям sidecar не следуем;
- explicit delete по hash охватывает все allowed extensions этого exact hash,
  потому что пользователь назвал content identity, а не одно недостоверное
  расширение из sidecar;
- config cache epoch передаётся явно в `resolveDecorAssets`, а capability в
  localStorage не сохраняется; свежий server response — единственный authority;
- 1000 мс для route-completion и 180 секунд + 10 секунд kill grace для файла —
  технические liveness budgets, не пользовательские таймауты;
- ссылки на строки из аудита ориентировочны: реализация привязывается к символам
  и проверяемому поведению на актуальном `dev`.
