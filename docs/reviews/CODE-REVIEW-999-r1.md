# CODE-REVIEW-999-r1

Материал: `c1adca26fab12958c22f1c8b3ea06d6521af55e7` (HEAD рабочей копии, подтверждён `git rev-parse HEAD`).
Диапазон: `git log --oneline origin/dev..HEAD` — 19 коммитов, `git diff origin/dev...HEAD` — 69 файлов,
+3725/-76. Трек `ask`, этап code, заход r1, блокирующих циклов израсходовано 0/4.

## Скоуп

Issue #999: разовый локальный просмотр маршрута прошлой уборки конкретного пылесоса
(поддерживаемый публичный history-контракт Dreame/Tasshack 2.0.2), без постоянного
архива, без команд роботу, без изменения калибровки/Store. UI-030 (owner-accepted
local material), жизненный цикл показа принят владельцем (комментарии
`#6374259259`/`#6385997987`), ТЗ дополнено 9 AC. Соответствует `docs/SCOPE.md` —
прямой narrow exception в разделе «History, graphs, statistics» (строки 112–118,
изменены этим же диффом) закрывает J1/J2 не напрямую, а как согласованное
расширение границ продукта: разовый spatial-просмотр, не HA history dashboard.

## Как проверялось

**Risk by changed hunks (#707), трек ask — сверка класса против AC ТЗ:**

| Класс | Участок | AC/документ, где поведение зафиксировано | Проверка |
|---|---|---|---|
| touch | `src/vacuum-history-banner.ts:10` (`@pointerdown` stopPropagation) | AC1 (узкий экран/keyboard), `TOUCH-SUPPORT.md` конвенция | Прочитан `git show c1adca26f` — тот же `@pointerdown=>stopPropagation()` паттерн используется в `decor-image-editor.ts`, `editor-context-menu.ts`, `led-strip-editor.ts`, `houseplan-card.ts` (не новый приём). Hover-подсветка переведена на существующий `:host([data-pointer-hover])` гейт (используется в `hp-dialog.ts`, `chrome.styles.ts`, `devices.styles.ts` и др.) — конвенция, не изобретение |
| migration | `custom_components/houseplan/vacuum_history.py:85` (докстрока «no migration or persistent job IDs») | ТЗ, «Модель данных и миграции»: Store schema/version не меняются | Прочитан модуль целиком: `_epochs`/`_watches` — `WeakKeyDictionary` в памяти процесса, без Store/версии схемы. Комментарий в коде прямо отрицает миграцию, что соответствует ТЗ, а не противоречит |
| devices | `custom_components/houseplan/websocket_api.py` (регистрация команды, capability flag, `vacuum_history_epochs` в `ws_trail_get`) | ТЗ, «Async/API, права...»: additive capability, без изменения формата | Прочитан полный diff файла — 8 реальных строк, все additive: новый импорт/регистрация обработчика, `"vacuum_history_api": 1` в capability-блоке `ws_config_get`, новое поле ответа `ws_trail_get`. Существующие поля/контракты не удалены и не изменены |
| ux | новые ключи `vac.history_banner/_hide/_limited/_interrupted` (View) и `marker.history_*` (28 ключей, lazy settings) | AC1/AC7, `docs/USER-GUIDE.ru.md` | Проверены все 4 View-локали (`de/en/fr/ru`) и все 4 settings-локали — набор ключей идентичен, без смешения языков; текст совпадает с ТЗ дословно («Выберите уборку», «Показать», «Скрыть с плана», «Маршрут виден только на этом устройстве...») |

Прочитаны докчитатели: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`, тело
issue #999 целиком и все 24 комментария (включая SPEC r1/r2 зелёный вердикт,
решения владельца о lifecycle и UI-030, промежуточные S6-чекпойнты, финальный
хендофф `#6391926271` и его S7-preflight подтверждения).

**Принятый validate-gate (review-light-golden) на материале `c1adca26f`:**
run [40150006954](https://github.com/Matysh/houseplan-card/actions/runs/40150006954),
conclusion `success`, headSha совпадает с материалом ревью. Прогнанные и зелёные
джобы: Hassfest, HACS repository validation, бэкенд pytest в реальной Home
Assistant, фронтенд типы/юниты/мутанты/bundle-sync, геометрия TS/Python parity,
упаковка кандидата, «Браузер: выбранные проверки push», «Продукт: свежие проверки
диапазона и упаковки», «Доказательство выполненных проверок». Полные смоки по
шардам/perf-smoke/Golden против эталонов в этом run `skipped` — это предрелизный
контур (§8), не адресован этой задаче: выбранные 52 smoke + 4 новых synthetic
Golden прошли отдельно и перечислены в хендоффе/`release-ledger`, см. ниже.
Этот proof не повторялся — переиспользован по правилу «пригодный неизменившийся
check не повторять».

**Адресные проверки сверх proof** (целевые пробелы, не покрытые общим run):

- Чтение `src/vacuum-history.ts` целиком — лайфсайкл `select/open/hide/suspend/
  synchronize/adoptEpochs/load/show`. Подтверждено построчно: dropdown-выбор
  (`history.selected=`) не вызывает `hide()`/`show()`; обычное закрытие диалога
  в `hostUpdate()` сбрасывает только `openDialog`, не `requested`/`shown` —
  соответствует принятому «Show intent отделён от dropdown selection и lifetime
  диалога» (решение владельца `#6386288363`).
- Чтение `test/vacuum-history.test.mjs` (24 теста) — подтверждено, что тесты
  реально проверяют нетривиальные инварианты (held A survives B/close, server
  authority предшествует stale client-флагу, suppression отзывает A до
  клиентского обновления конфигурации, ordinary error сохраняет валидный A,
  рендер отказа не превращается в polling), а не формальные ассерты.
- Чтение `custom_components/houseplan/vacuum_history.py`,
  `vacuum_history_websocket.py`, `vacuum_camera_read.py` целиком — подтверждена
  авторитетная привязка marker→vacuum→camera, typed-проверка
  `history_map is True`/`completed: bool`, закрытый декодер, физический lease
  переиспользован (`vacuum_camera_read.py`), без self-HTTP/новых сервисов.
- Чтение `tests_backend/test_ha_vacuum_history.py` (15 тестов) — параметризация
  `group/admin_only/allowed` = `(None,True,True)`, `(USER,False,True)`,
  `(USER,True,False)`, `(READ_ONLY,False,False)` реально покрывает
  writer/non-admin-writer/read-only (AC6). Все три Store (`config_store`,
  `store`, `rec.store`) патчатся на `pytest.fail` при `async_save` — это
  действующий отрицательный свидетель записи «в тесте», не мутант, и он
  исполняется в обычном прогоне (а не на ветке `allowed=False`, где
  `camera.calls` тоже проверяется пустым).
- Сверка таблицы состояний кнопок ТЗ против `src/editors/vacuum-history-section.ts`:
  `Show` → `?disabled=${!history.canShow}`, заливка `class="on"` только при
  `history.visible` (т.е. фактически нарисовано, не просто `shown`); `Hide` →
  `?disabled=${!history.visible}`. Все 4 строки таблицы ТЗ воспроизведены точно.
- Сверка `_renderVacuums` в `src/houseplan-card.ts` (diff целиком): историческая
  геометрия красится только для своего `marker.id`, расходует общий
  `trailBudget`, подавляет `previousRuns`/`showCur` только для своего устройства
  (`!history && ...`) — другие роботы и live/dock не затронуты; применяется
  через `history.applicable`, который проверяет `_mode==='view'||'devices'`
  (Plan/Decor исключены без смены режима).
- Сверка witness-id из таблицы «AC · чем доказан · чем краснеет» хендоффа
  `#6391926271` против `scripts/mutation-registry.mjs`: все 11 новых id
  (`vacuum-history-retired-show-adopted-999`,
  `vacuum-history-stale-catalog-accepted-999`,
  `vacuum-history-live-payload-admitted-999`,
  `vacuum-history-catalog-allocation-unbounded-999`,
  `vacuum-history-initial-get-owner-keeps-preview-999`,
  `vacuum-history-get-suppression-retains-preview-999`,
  `vacuum-history-server-denial-keeps-preview-999`,
  `vacuum-history-retired-owner-reported-as-record-error-999`,
  `vacuum-history-new-catalog-keeps-old-preview-999`,
  `vacuum-history-catalog-aba-admitted-999`,
  `vacuum-history-capture-inputs-untracked-999`) зарегистрированы с осмысленным
  `because`/`patches`/`guard`, не исполнялись (ночной régime). Два существующих
  якоря (`wall-dialog-back-inside-camera-layer`, guides-lifecycle suspend-мутант)
  корректно сдвинуты под новые соседние строки без ослабления исходного
  оракула — проверено построчно, что убираемая/заменяемая цель патча та же.
- Трейлеры: все 19 коммитов несут `Issue: #999`; каждый `User-Visible: yes`
  (6 коммитов) правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в этом же
  коммите — проверено `git show --stat` по каждому.
- `docs/release-ledger/v1.82.0/999.json`: `category: major` с явным rationale
  относительно предыдущего stable v1.82.0 (новая видимая пользователю
  возможность, не инфраструктура и не внутрибетный фикс) — авторское суждение
  корректно по критерию REVIEWER.md.
- Одно число — один источник (§8): лимит каталога «100 записей» встречается
  трижды — `HISTORY_LIMIT = 100` (`vacuum_history.py`), защитный клиентский
  guard `v.records.length>100` (`vacuum-history-values.ts`), и текст
  `marker.history_limited` во всех 4 settings-локалях. Три независимых места
  без общей константы — но это установленная конвенция проекта на границе
  Python/TypeScript (тот же паттерн у существующего «8 MiB» в
  `backup.error.*`), а не новый антипаттерн этой задачи; `100`/`64 KiB`
  дополнительно отмечены в ТЗ как «Принято предположительно, поменять
  свободно» — при пересмотре автор обязан тронуть все три места. Не поднимаю
  до Medium: расхождение с объявленной конвенцией проекта не продемонстрировано.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- Touch/hover-гейтинг баннера (`:host([data-pointer-hover])`, `@pointerdown`
  stopPropagation) использует существующие конвенции, не вводит новых.
- Нет миграции/Store schema изменений; `vacuum_history.py` явно документирует
  это инвариантом в коде.
- `websocket_api.py` — три additive-изменения (регистрация, capability flag,
  новое поле ответа), старые поля/контракты не тронуты.
- i18n — 4 View-локали и 4 settings-локали синхронны, текст соответствует ТЗ.
- Lifecycle-инварианты (Show intent ≠ dropdown selection ≠ dialog lifetime;
  server authority опережает stale client-флаги; ordinary error сохраняет
  валидный A; suppression/permission revoke отзывают preview) реализованы и
  покрыты содержательными unit-тестами на фронтенде и ACL-тестами на бэкенде
  (реальная HA, `pytest tests_backend/test_ha_vacuum_history.py`).
- Store-writes запрещены действующим `pytest.fail`-патчем на все три Store в
  позитивном и запрещённом (`allowed=False`) сценариях AC6.
- Рендер истории подавляет только собственный current/previous выбранного
  маркера, делит общий `trailBudget`, применим только в View/Devices.
- UI state table (4 строки ТЗ: disabled/filled Show, disabled Hide) дословно
  воспроизведена в `vacuum-history-section.ts`.
- Changelog/release-ledger/USER-GUIDE/VACUUM/UX-MODES/ARCHITECTURE обновлены
  консистентно с принятым ТЗ и терминологией.
- Все 11 новых registry-свидетелей по защитным AC корректно зарегистрированы с
  `because`/`guard`/`patches`; два существующих якоря сдвинуты без ослабления
  оракула.
- Трейлеры `Issue`/`User-Visible` и парные changelog-правки — на каждом
  затронутом коммите.

## Чего не проверял

- Не исполнял ни одного мутанта (ни новых 11, ни двух сдвинутых якорей) — это
  запрещено вне ночного workflow; статус «caught» по ним остаётся `unknown` до
  ночного прогона реестра, как и заявлено в хендоффе.
- Не повторял общий `npm run build`/`tsc`/`npm test`/`gate:small` — принятый
  validate-gate run 40150006954 на этом же SHA их уже покрыл зелёным.
- Не запускал полные browser-смоки по шардам, perf-smoke и Golden против
  принятых эталонов — они `skipped` в validate-gate как предрелизный контур
  (§8); выбранные 52 smoke + 4 новых Golden исполнены автором и зафиксированы
  в `release-ledger`/хендоффе, глобальная приёмка эталонов — перед бетой.
- Не проверял реальное взаимодействие с установленным Dreame-роботом/облачным
  decoder — это прямо заявлено автором как неподтверждённое этим анализом
  (`feasibility, не live HA acceptance`), и ТЗ честно оставляет эту границу
  открытой, а не выдаёт за готовую поддержку.
- Не сравнивал приватный UI-030 материал напрямую — он не публикуется; принял
  авторское заявление о 12/12 пиксель-идентичных сравнений markup/CSS раздела
  (не всего приватного плана) как «проверено чтением хендоффа», без
  возможности независимо пересчитать приватные скриншоты.
- Не проверял Windows-сборку/байтовые метрики бандла заново — измерения
  (`development-notes/vacuum-history-measurement.json`) и повышение
  blocking-референсов основаны на отдельном разрешении владельца
  (`#6391633547`) и не являются предметом этого ревью по существу (не AC, не
  риск правильности).
- `npm run invariants` не запускал — диапазон не меняет геометрическую модель
  (использует существующий `applyAffine`/`VacuumPathGeometryCache`); отдельная
  джоба «Геометрия: TS/Python parity исполнена» в validate-gate уже зелёная.

## Маршрут

`route: fix` (задано пакетом; не `show`, критерий §5 не применяется).

Побочных находок нет (политика `mode=issues` — новые issue не заводятся, т.к.
находок вне скоупа нет).

Документ: `docs/reviews/CODE-REVIEW-999-r1.md` (публикует шаг конвейера).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/999-vacuum-history`, коммит `c1adca26fab1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `be37421edfa278b88f968f919ac0dc14f6fe037e`
  ```
  git log --all --format='%H %T' | grep be37421edfa2
  ```
- Тело issue: `dadab69fdb4ecdadf66b380419f5d0f8545e8c228f8288461ebe2fc460598415`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNjIsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjU2OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzYsIm91dHB1dF90b2tlbnMiOjI2Nzg2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0NTkxNSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ0NjYwMTgsImNvc3RVc2RFc3RpbWF0ZSI6MS43NDQ4NzU2MDAwMDAwMDAzfV0sInR1cm5zIjo0NCwiZHVyYXRpb25NcyI6MzMzNTIyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS43NTAxMzI2MDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5238 output_tokens=26805 cache_creation_input_tokens=145915 cache_read_input_tokens=4466018 num_turns=44 -->
