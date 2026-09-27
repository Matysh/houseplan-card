# ТЗ #440 — Полиш аудита v1.71.0-beta.2

- Issue: https://github.com/Matysh/houseplan-card/issues/440
- Приоритет: P2, `bug` / `polish` / `tests`
- Маршрут: full; задача затрагивает несколько независимых TypeScript- и
  Python-поверхностей, touch-контракт View и защитные гейты, поэтому нарушает
  ограничения лёгкого трека по сложности и одной поверхности
- Связанные контракты: #372 (compact static card), #426 (room tooltip toggle),
  #429/#430 (инфраструктурные гейты), #431 (канонизация image decor), #432
  (asset integrity/resolve), #434 (предыдущий audit polish)

## Сценарий

Home admin открывает план мышью, пером или на touch-устройстве, меняет язык,
подтверждает опасные действия и загружает либо показывает пользовательские
изображения подложки. В редком повреждённом состоянии asset-каталога вместо
обычного файла может оказаться специальный filesystem object либо запись может
исчезнуть во время inventory. Разработчик при этом ожидает, что защитные тесты
исполняются и действительно замечают снятую гарантию как локально, так и в CI.

## Что человек увидит до и после

**До:** специальный файл с допустимым asset-именем может навсегда занять поток
Home Assistant при HTTP-проверке; исчезнувшая во время inventory запись даёт
500, а повреждённый orphan ошибочно выглядит как нехватка места с HTTP 507.
При выключенной подсказке комнаты смена мыши на pen/touch внутри уже наведённой
комнаты может оставить transient hover. Остальные пункты сегодня внешне
работают, но держатся на неявном побочном эффекте getter либо слабом/CI-only
свидетеле.

**После:** необычные и исчезнувшие asset entries быстро и безопасно
отбрасываются, код HTTP соответствует причине ошибки, а реальный pen/touch
всегда снимает mouse-only hover независимо от настройки room tooltip. Языковые
переходы и static-card capability внешне остаются прежними, но охраняются
явными командами и исполнимыми поведенческими тестами.

## Проблема и подтверждённые причины

1. `AssetIntegrityVerifier.verify()` строит сигнатуру через обычный `stat()` и
   передаёт путь `_stream_sha256()`. FIFO/устройство проходят эту границу, а
   blocking `open("rb")` может не вернуться. Followers того же single-flight
   безусловно ждут `event.wait()`.
2. Room `pointermove` при `show_room_tooltip: false` возвращается раньше
   `_showTip()`, то есть раньше пути, который вызывает `_notePointer()`.
   `pointerenter` не покрывает смену pointer type внутри уже занятой комнаты.
3. Getter `_dangerConfirmLocaleGate` вызывает mutating
   `languageRenderGate()`: меняет `inert`, `aria-busy`, `lang`, WeakSet-состояние,
   запускает lazy load и `requestUpdate()`. Его побочный эффект нужен текущему
   переходу warm→ready до render, но имя и форма скрывают эту обязанность.
4. `physical_asset_blobs()` не изолирует `OSError` между `iterdir()` и
   `stat(follow_symlinks=False)`, а `physical_asset_usage()` повторно делает
   `stat()` без защиты. `_store()` затем отображает любой `DecorAssetError` в
   HTTP 507, хотя 507 означает только `capacity_exceeded`; `invalid_image`
   должен оставаться клиентским отказом 400.
5. Пять assertions в `test/space-card-audit-lows.test.mjs` проверяют текст
   исходника. Большая часть соответствующего контракта уже покрыта
   `config-store` unit, `decor-assets` unit и
   `smoke_space_card_decor_capability`, но source-regex остаётся ложной
   гарантией и лишней чувствительностью к рефакторингу.
6. `pytest.importorskip("homeassistant")` на уровне
   `test_coordinate_canonicalization.py` скрывает чистые проверки
   `DECOR_BOX_KINDS` и numeric canonicalization в среде без HA. Поэтому мутант
   `image-box-python-canonicalization-omitted` может завершиться зелёным skip.
7. #429 и #430 намеренно были чистыми инфраструктурными задачами без файлов
   класса A. `PROCESS.md` §1 исключает для них ТЗ и код-ревью; подробные
   closing-комментарии и коммиты уже являются корректным следом. Это не дефект
   реализации и не требует синтетического review-документа задним числом.

## Скоуп

В скоупе:

- fail-fast regular-file boundary перед digest/cache/single-flight публикацией;
- конечное ожидание followers как дополнительная защита liveness;
- сохранение fail-dark HTTP 404 для отсутствующего, изменившегося,
  специального либо неподтвердившегося asset blob;
- обновление pointer modality на каждом реальном room pointermove в View,
  включая выключенный tooltip;
- явная command/query граница для danger-confirm locale state при полном
  сохранении ready/cold/warm поведения #434;
- устойчивый к исчезновению файлов physical asset inventory;
- точное отображение store errors: capacity → 507, invalid image/прочий
  корректный клиентский отказ → 400, `OSError` → прежний 500 `io_error`;
- замена source-regex AC5 #434 поведенческими unit/smoke-свидетелями;
- HA-независимый модуль чистых Python canonicalization-тестов и перевод
  соответствующих mutation guards на него;
- тесты, mutation witnesses, техническая документация и changelog.

## Не-скоуп

- новый asset format, protocol capability, digest, quota либо filesystem
  watcher;
- поддержка FIFO/devices/sockets как изображений или попытка читать их с
  timeout;
- автоматическое удаление необычных/orphan entries;
- изменение прав доступа, signed URL, catalog/list/resolve semantics или
  content-addressed имени;
- новый room tooltip, отдельный pen UX либо изменение touch-first контракта;
- новый вид/текст danger confirmation или изменение fallback-языка;
- рефакторинг всего `LanguageRuntime` либо всех Lit render gates;
- изменение канонизации координат, schema/storage результата #431;
- создание review-документов задним числом для #429/#430;
- golden, performance baseline или полный Windows HA harness.

## Контракт поведения

### 1. Целостность asset и liveness

Verifier принимает к хешированию только существующий обычный файл. Directory,
FIFO, socket, block/character device, broken link и исчезнувший путь дают
`false` до вызова digest hasher и не создают доверенную cache entry.

Проверка типа выполняется как часть обеих сигнатур — до и после чтения. Digest
публикуется только если один и тот же обычный file version оставался стабильным
по size/mtime/ctime. Ошибка либо смена типа очищает stale cache для canonical
path и будит followers с `false`.

Follower не ждёт бесконечно даже при неожиданно зависшем/injected owner:
ожидание имеет конечную внутреннюю границу и при её истечении возвращает
`false`, не удаляя чужой in-flight record и не публикуя digest. Значение границы
техническое; оно должно существенно превышать чтение разрешённого asset
максимального размера и не является пользовательским network timeout.

HTTP content endpoint сохраняет прежнее поведение: verifier `false` означает
404 без передачи файловых деталей клиенту. Обычные корректные assets и LRU
single-flight/cache работают как раньше.

### 2. Pointer modality при выключенной подсказке комнаты

Каждый настоящий room `pointermove` в View сначала сообщает pointer type общей
instance-local modality, а уже потом решает, показывать ли room tooltip.

- `mouse` сохраняет существующие room fill/hover и tooltip rules;
- `touch` или `pen` снимает `_tip` и `_hoverRoom`, которые принадлежат
  mouse-hover, даже при `show_room_tooltip: false`;
- выключенная подсказка не считает area/temp/humidity/LQI и не создаёт tooltip;
- editor modes и device/opening tips не получают нового UX.

Повторный вызов modality helper на пути включённого tooltip не должен менять
наблюдаемое поведение или порождать лишнее состояние.

### 3. Явная locale command для danger confirmation

Mutating синхронизация языка не маскируется getter-ом. Call site, которому
нужно актуализировать `inert`/attributes/lazy load и получить gate, вызывает
явно названную command-функцию/метод; чистое чтение уже вычисленного значения,
если потребуется, не имеет побочных эффектов.

Сохраняются все ветви #434:

- ready/fallback до следующего render немедленно разрешает обычный request и
  снимает `inert`/`aria-busy`;
- warm немедленно возвращает `false`, не оставляет controller request;
- ready→warm отменяет уже открытое подтверждение до потери decision source;
- cold first frame остаётся language-neutral loading surface;
- stable body в warm не заменяется, согласие между языковыми состояниями не
  переносится.

Ни render, ни `willUpdate`, ни `_confirmDanger()` не читают property, похожее на
обычный getter, если это чтение меняет DOM/host/runtime state.

### 4. Inventory race и HTTP status

Physical inventory обходит только exact allowed-extension/hash candidates и
учитывает только успешно наблюдённые обычные файлы. Если root либо отдельная
entry исчезла, стала недоступна или сменила тип между обходом и stat, этот
кандидат пропускается, остальные продолжают считаться. Одна race не превращает
весь upload в `io_error`.

Семантика quota остаётся консервативной в пределах одного наблюдения: count и
bytes относятся к тем же успешно stat-нутым regular candidates; sidecar по-
прежнему не является authority physical usage.

Ответ upload после `_store()`:

- `DecorAssetError("capacity_exceeded")` → HTTP 507 с тем же error code;
- `DecorAssetError("invalid_image")` и иные не-capacity validation/integrity
  коды → HTTP 400 с исходным code/message;
- неожиданный `OSError` → HTTP 500 `io_error`;
- успех/reused и pre-store `too_large`/format behavior не меняются.

### 5. Поведенческие witnesses static-card capability

Source-regex блок #434 удаляется как гарантия. Его контракт доказывается через
публично наблюдаемые данные и вызовы:

- fresh `config/get` принимает только exact API v1 и отзывает capability при
  missing/другом значении;
- localStorage snapshot никогда не выдаёт runtime capability;
- static card без v1 не вызывает resolve и очищает runtime asset map;
- capability-only upgrade/downgrade принимается при том же config body;
- resolve cache разделён authoritative revision/epoch и повторяет прежний
  missing на новом epoch.

Если существующие unit/smoke уже доказывают строку полностью, они расширяются
только недостающим отрицательным кейсом; дублирующий regex не сохраняется.
Mutation/negative run обязан краснеть на наблюдаемом счётчике вызовов, snapshot
либо map, а не на изменении форматирования исходника.

### 6. Чистая Python-канонизация исполняется без HA

Тесты, которым нужны только
`custom_components.houseplan.coordinate_canonicalization` и JSON fixture,
живут в отдельном модуле до любой HA-зависимой загрузки. Как минимум туда
переходят:

- общий scalar/lattice fixture contract;
- exact `DECOR_BOX_KINDS` и image box field preservation;
- scalar symmetry/off-grid behavior;
- 4801 lattice nodes и nine-decimal forms.

Schema, store, virtual lights и wall segment tests остаются в HA-зависимом
модуле под честным `importorskip`. Mutation guards для чистых Python contracts
указывают новый модуль и в среде без Home Assistant обязаны давать реальный
pass/fail, а не module skip. Дублировать одни assertions в обоих файлах нельзя.

### 7. Пункт #429/#430

Никаких продуктовых либо repository-правок ради создания отсутствовавшего
review artifact не делается. ТЗ и итоговый комментарий #440 фиксируют проверку:
обе задачи были infrastructure-only и прошли допустимый §1 маршрут. Если
выяснится, что их коммиты всё же содержали класс A, это новая process issue, а
не скрытое расширение #440.

## Модель данных, совместимость и i18n

- Persisted config/layout, schema version, asset sidecar и API capability не
  меняются; миграции нет.
- HTTP status исправляется без изменения JSON `error`/`message` формы.
- Новых пользовательских строк нет; словари en/ru/de/fr не меняются.
- Старые frontend/backend combinations сохраняют действующие fail-closed
  capability и content URL contracts.

## Touch и доступность

View остаётся touch-first. Исправление pointer modality восстанавливает
обязательный контракт `docs/TOUCH-SUPPORT.md`: touch/pen не наследует визуальное
состояние mouse hover. Никаких новых жестов, click targets или editor touch
обещаний нет.

Danger-confirm сохраняет `alertdialog`, focus, inert и aria-busy semantics;
меняется только явность точки, где эти эффекты синхронизируются.

## Производительность и безопасность

- Regular-file check добавляет bounded stat/type verification вокруг уже
  существующего SHA-256 и не расширяет число хеширований/cache entries.
- Конечное follower wait не удерживает executor бесконечно; обычный cache hit и
  single-flight путь остаются O(1).
- Inventory остаётся O(entries) под существующим `upload_lock`, quota физически
  ограничивает каталог; исчезнувшая entry не останавливает весь scan.
- Необычный файл никогда не читается и не становится trusted asset. Ошибки не
  раскрывают filesystem path/type.
- Pointer и locale изменения не добавляют работу в стабильный кадр сверх уже
  существующего modality/gate вызова; это подтверждается review кода, нового
  performance baseline не требуется.

## Затронутые модули

Ожидаемый набор; точное выделение helpers может быть скорректировано ревьюером:

- `custom_components/houseplan/asset_integrity.py`;
- `custom_components/houseplan/decor_assets.py`;
- `custom_components/houseplan/http_api.py`;
- `src/houseplan-card.ts`, при необходимости
  `src/i18n/language-runtime.ts`;
- `tests_backend/test_decor_assets.py`, новый чистый Python test module и
  соответствующие HA endpoint tests;
- `test/space-card-audit-lows.test.mjs`, `test/config-store.test.mjs`,
  `test/decor-assets.test.mjs`;
- `demo/smoke_room_tooltip_toggle.mjs` либо отдельный pointer-modality smoke,
  `demo/smoke_danger_confirm_branches.mjs`,
  `demo/smoke_space_card_decor_capability.mjs`;
- `scripts/mutation-gate.mjs`;
- `docs/ARCHITECTURE.md`, `docs/TESTING.md`, оба changelog и docs screenshot
  fingerprint, если их действующие разделы требуют обновления.

## Критерии приёмки

- **AC1 (backend/unit, safety/liveness).** Обычный asset с верным digest
  проверяется и кэшируется; directory/FIFO/другой non-regular и исчезнувший
  path возвращают `false` без вызова hasher. Followers получают тот же результат
  и конечный wait не зависает. Смена bytes/type между сигнатурами не публикует
  cache. **Доказательство:** pure verifier matrix, POSIX FIFO case под
  platform-skip и отдельный injected timeout/flight case.
- **AC2 (browser smoke, touch).** При выключенном room tooltip переход реального
  pointermove mouse→pen и mouse→touch внутри комнаты снимает `_tip` и
  `_hoverRoom`, не создаёт новый tooltip и не вычисляет room metrics; mouse и
  включённый tooltip остаются прежними. **Доказательство:** targeted browser
  smoke с pointer events и metric spies.
- **AC3 (browser smoke + review, lifecycle).** Danger locale sync вызывается
  явной command-границей, getter с mutating `languageRenderGate()` отсутствует;
  ready→warm, warm refusal, warm→ready до render, cancellation, stable body и
  inert/aria-busy проходят прежнюю полную матрицу. **Доказательство:**
  `smoke_danger_confirm_branches` + negative mutation, diff review command/query
  call sites.
- **AC4 (backend/unit + HA endpoint, correctness).** Исчезновение/type-change
  одного inventory candidate не останавливает scan и не искажает остальные
  count/bytes. Capacity store error отвечает 507, invalid orphan image — 400,
  `OSError` — 500 `io_error`; body code сохраняется. **Доказательство:**
  filesystem race matrix + upload response matrix.
- **AC5 (unit/smoke, compatibility).** Все пять static-card capability/cache
  обещаний #434 доказаны значениями snapshot/map и WS counters; source-regex
  для этого блока удалён. Снятие exact capability revocation/adoption краснит
  поведенческий тест. **Доказательство:** config/decor units,
  `smoke_space_card_decor_capability` и targeted mutation.
- **AC6 (backend/unit + mutation, harness).** Чистые coordinate/image
  canonicalization tests выполняются без установленного `homeassistant`; HA-
  dependent tests по-прежнему честно skip-аются локально и исполняются в Linux
  CI. `image-box-python-canonicalization-omitted` и чистый lattice mutant
  краснеют на новом модуле. **Доказательство:** pytest в среде без HA,
  backend-test-guard и оба mutation ids.
- **AC7 (review/docs, scope).** #429/#430 не получают ретроактивных artifacts;
  нет schema/API/i18n/устойчивого визуального изменения. Обычная раздача assets,
  upload success/reuse, tooltip-on и language fallback остаются совместимы.
  **Доказательство:** diff review, существующие contract tests и документация.
- **AC8 (gates).** Typecheck, unit, build/bundle sync, выбранные browser smokes,
  чистые backend tests, Linux HA CI, docs checks и новые mutation witnesses
  зелёные на exact SHA. Golden и full performance остаются предрелизными.

## Таблица защитных доказательств

| AC | Чем доказан | Чем обязан покраснеть |
|---|---|---|
| AC1 | verifier regular/non-regular/single-flight matrix | снятие regular-file boundary вызывает hasher на sentinel/FIFO; снятие wait boundary оставляет controlled follower unresolved |
| AC2 | room pointer-modality browser smoke | перенос `_notePointer` обратно после tooltip guard оставляет `_hoverRoom`/`_tip` после pen/touch |
| AC3 | danger locale branch smoke | возврат mutating getter/cached прошлого render даёт ложный warm отказ либо оставляет inert/controller в переходе |
| AC4 | inventory race + upload status backend tests | проброс `OSError` снова делает 500; общий status 507 заставляет invalid-image assertion получить неверный статус |
| AC5 | config-store/decor units + static-card WS smoke | снятие exact capability adoption/revocation вызывает resolve на старом backend либо оставляет asset map после downgrade |
| AC6 | HA-free pytest module + mutation guards | удаление `image` из Python `DECOR_BOX_KINDS` либо изменение lattice rounding даёт failed assertion, не skipped module |

Для AC1–AC6, заявляющих защиту, code-review обязан привести точный negative
run по правилу `PROCESS.md` §2.7. Persistent mutation нужен для дорогого
browser/backend witness; для чистого unit допустим документированный red-run со
снятой защитой.

## План автотестов

1. Расширить verifier tests обычным файлом, missing/directory/non-regular,
   stable/changed signature, owner/follower и истёкшим follower wait. Реальный
   FIFO создавать только на POSIX; cross-platform seam доказывает отсутствие
   вызова hasher независимо от платформы.
2. В browser harness заранее создать mouse-owned room tip/fill, выключить
   tooltip и отправить pen/touch `pointermove` без нового `pointerenter`.
   Отдельными spies доказать отсутствие room metric work.
3. Сохранить полную locale branch matrix, но вызывать публично наблюдаемое
   действие, а не читать mutating getter ради продвижения состояния.
4. Подменить inventory entry/stat так, чтобы один кандидат исчез, а следующий
   regular blob сохранил count/bytes. Через upload view проверить три status
   класса без реальной нехватки диска.
5. Сопоставить каждую из пяти удаляемых regex-строк с существующим assertion;
   добавить только отсутствующий capability-only case и mutation, затем удалить
   source-form block.
6. Перенести чистые Python tests без дублирования, запустить новый файл в
   окружении без HA и перенаправить mutation guards `decor_box_catalog...` и
   `all_4801_lattice_nodes...` на него.
7. На implementation SHA прогнать штатные гейты и каждый новый/перенесённый
   negative witness; failure должен быть целевым assertion, не import/skip,
   timeout всего процесса или отсутствующим браузером.

## Риски

- **Regular check не закрывает race между path stat и open.** Смягчение:
  post-read signature/type guard и fail-dark результат; реализация вправе
  использовать безопасный file-descriptor seam, если это не ломает injected
  hasher tests и Windows.
- **Слишком короткий follower timeout даст ложные 404 на медленном диске.**
  Смягчение: техническая граница существенно выше чтения максимальных 2 MiB,
  обычный owner продолжает и может заполнить cache для следующего запроса.
- **Пропуск исчезнувшей entry временно недосчитает quota.** Это внешний race в
  config-каталоге; House Plan writers уже сериализованы `upload_lock`, а
  следующий запрос пересканирует store. Нельзя превращать один race в отказ
  всех корректных upload.
- **Locale refactor изменит тонкое pre-render окно.** Смягчение: существующий
  smoke сохраняется как основной acceptance witness и получает negative proof.
- **Удаление regex оставит дыру.** Смягчение: таблица соответствия пяти строк
  наблюдаемым unit/smoke assertions до удаления и mutation по поведению.
- **Перенос Python tests изменит CI collection.** Смягчение: отсутствие
  дубликатов, отдельные прогоны с/без HA и существующий harness audit.

## Откат

Откат — единый revert implementation commit вместе с тестами и release-
артефактами. Persisted data и migration отсутствуют. Если потребуется частичный
аварийный откат, backend regular-file/status fixes и frontend pointer/locale fix
могут быть возвращены независимыми атомарными коммитами только вместе со своими
свидетелями; возврат зависающего FIFO либо ложного 507 не считается безопасной
деградацией.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: fail-fast asset verification,
  честные upload errors и восстановление pointer modality;
- `docs/ARCHITECTURE.md`: обновить только если описание asset integrity не
  фиксирует regular-file/fail-dark границу;
- `docs/TESTING.md`: HA-free canonicalization witnesses и отказ от source-regex
  как семантического доказательства;
- docs screenshot workflow: подтвердить нулевую pixel-дельту и принять только
  source fingerprint после `src/**`;
- user guide, i18n, golden baselines, performance/security profiles и schema
  docs: без изменений;
- implementation commit — `User-Visible: yes`, обе записи changelog в том же
  коммите; чистый follow-up fingerprint/review doc — `User-Visible: no`.

## Принятые технические предположения

Эти решения не меняют продуктовый замысел и могут быть свободно скорректированы
ревьюером до S5:

- задача остаётся единым audit batch: пункты малы, имеют общую цель hardening и
  требуют одного согласованного набора negative witnesses;
- follower timeout — внутренняя liveness-защита, а не обещание времени HTTP-
  ответа; точное число выбирается по текущему 2 MiB лимиту и тестируется через
  injected event, без реального ожидания;
- non-capacity `DecorAssetError` после `_store()` отображается в 400, потому что
  его code описывает непринимаемый asset, а не состояние диска;
- mutating language sync может оставаться вызываемой из Lit lifecycle и action
  path, но обязана называться командой и не притворяться property read;
- существующие поведенческие tests переиспользуются вместо создания второго
  параллельного harness, если они полностью доказывают AC;
- ссылки на номера строк из аудита ориентировочны: реализация привязывается к
  символам и поведению актуального `origin/dev`.
