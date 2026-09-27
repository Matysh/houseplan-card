# ТЗ #442 — Атомарный откат отклонённых записей маркера

- Issue: https://github.com/Matysh/houseplan-card/issues/442
- Приоритет: P2, `bug`
- Статус ТЗ: готово к ревью
- Маршрут: full; меняются основной Save устройства и сохранение калибровки
  робота, включая отказный UX и конкурентный контракт
- Связанные контракты: #439 (guarded optimistic rollback общих настроек),
  #441 (атомарные CRUD-операции маршрутов карт), #162 (маршрутная
  калибровка робота), #314 (отдельный откат физической геометрии)

## Сценарий

Home admin редактирует устройство либо калибрует карту робота. Backend
отклоняет `config/set` из-за semantic validation, конфликта или транспортной
ошибки. Карточка должна сразу снова показывать последнее подтверждённое
сервером состояние, но не терять введённый в открытом UI draft: пользователь
исправляет значение или повторяет сохранение без перезагрузки карточки и без
повторной ручной подгонки.

## Что человек увидит до и после

**До:** после отказа основной Device editor сообщает об ошибке, но локальный
marker остаётся изменённым и может попасть в View либо в следующую запись.
Калибровка закрывается и показывает success до ответа сервера; при отказе на
экране остаётся фантомная матрица, а ручную подгонку приходится повторять.

**После:** непринятый marker config автоматически возвращается к последнему
подтверждённому состоянию. Device editor остаётся открыт с введёнными полями.
Auto/manual calibration остаётся открытой и занятой до ответа: при успехе она
закрывается и только затем сообщает об успехе, при отказе сохраняет рассчитанный
draft для Retry и показывает ошибку.

## Подтверждённая проблема

1. `HouseplanEditorRuntime._saveMarker()` меняет `cfg.markers` до
   `await _saveConfigNow()`. Обычный `catch` снимает `busy` и показывает toast,
   но не возвращает `_serverCfg`, не перестраивает devices и не отделяет отказ
   `config/set` от ошибок последующих layout/file housekeeping.
2. Backend реально может отклонить доступные из Device editor изменения через
   `validate_marker_controls`, `validate_marker_light_entities`,
   `validate_marker_value_badges` и `validate_marker_vacuum_routes`.
3. `_vacSaveMatrix()` мутирует marker in-place, перестраивает devices и вызывает
   debounced `_saveConfig()`, после чего callers сразу закрывают
   `_vacCalConfirm`/`_vacFit` и показывают `vac.autocal_done` либо
   `vac.cal_done`. Promise результата у UI нет.
4. CRUD маршрутов в `src/editors/vacuum-maps-section.ts` уже использует
   `optimisticAttempt()`/`rollbackOptimistic()` и остаётся эталоном, а не второй
   реализацией в рамках #442.
5. Общий writer уже сериализует запросы и отдельно обрабатывает conflict и
   physical geometry. #442 не должен подменять эти механизмы глобальным reload
   либо откатом несвязанной транзакции.

## Скоуп

В скоупе:

- атомарный immutable candidate для основного Save устройства;
- guarded rollback всего config-кандидата при отказе именно его `config/set`;
- восстановление производных marker/device представлений после отката;
- сохранение draft Device editor и возможность Retry;
- асинхронная запись auto-calibration, принятого high-residual proposal и manual
  fit;
- busy-состояние калибровочного UI до ответа сервера;
- success toast и закрытие calibration UI только после подтверждённой записи;
- сохранение рассчитанной матрицы или параметров ручной подгонки при отказе;
- конкурентные случаи conflict reload и более новой локальной ревизии;
- регрессия атомарных маршрутов #441;
- unit, browser smoke и mutation witnesses;
- документация и оба changelog.

## Не-скоуп

- атомаризация всех 18 generic `_saveConfig()` call sites;
- Hide/Show, удаление marker, discovery seeding, обычные `live`, `trail_mode` и
  `source` настройки робота, если они не входят в сохраняемый calibration/route
  candidate;
- изменение четырёх backend validators, schema либо формата ошибок;
- изменение математики auto-calibration, residual threshold или manual fit;
- изменение маршрутизации карт, route identity либо выбора этажа;
- откат физической геометрии или замена механизма #314;
- транзакционное удаление безвредных файлов-копий после rejected rebind;
- новый глобальный transaction manager для всех editor writes;
- новые тексты ошибок, отдельные модальные предупреждения или дополнительные
  подтверждения.

## Контракт поведения

### 1. Граница marker-транзакции

Основной Save строит новый `ServerConfig` как отдельный candidate из текущего
подтверждённого root. До отправки не допускается in-place изменение предыдущего
`cfg.markers`: предыдущий config должен оставаться пригодным для точного
восстановления.

Одна попытка фиксирует:

- глубокую копию предыдущего config;
- предыдущий `_cfgContentFingerprint`;
- `_cfgRev` до отправки;
- candidate и его content fingerprint.

Candidate может быть показан оптимистично, но при отклонении его
`config/set` вызывается guarded rollback. После успешного rollback карточка
сбрасывает marker-derived caches/signature, перестраивает devices и запрашивает
render. Ни одно поле непринятого marker не остаётся в View или следующей записи.

Конфигурационная транзакция заканчивается сразу после успешного
`_saveConfigNow()`. Layout update, очистка старого layout id и файловое
housekeeping выполняются только после durable config acceptance. Ошибка такого
последующего best-effort шага не имеет права откатывать уже принятый сервером
config.

### 2. Guarded rollback и конкуренция

Rollback применяется только если текущие revision и content fingerprint всё
ещё принадлежат не принятому candidate. Сравнение content обязательно и для
того же object identity: более новая in-place правка не может быть затёрта
старым reject.

Таблица решений:

| Событие во время попытки | Итог |
|---|---|
| semantic/schema/transport reject, candidate всё ещё текущий | восстановить previous config и прежний fingerprint |
| `conflict`, `_saveConfigNow()` уже перечитал server truth | не откатывать authoritative reload |
| появилась более новая local revision/content | не откатывать новую правку |
| пользователь закрыл диалог во время запроса | config откатывается по guard; диалог не воскрешается; toast остаётся |
| config принят, затем упал layout/file side effect | принятый config остаётся; сообщается ошибка соответствующего шага |

Сериализация через существующую `_writeChain` и `expected_rev` сохраняется.
Pending debounced write не должен обгонять прямой marker/calibration save; один
и тот же candidate не отправляется повторно скрытым debounce.

### 3. Основной Device editor

При Save UI становится busy и не запускает вторую попытку. После успеха
сохраняется текущий UX: диалог закрывается, devices перестраиваются и
показывается `toast.marker_saved`.

При отказе config-записи:

- `_serverCfg` и отображение возвращаются к accepted state;
- диалог, если он ещё открыт, остаётся открыт и выходит из busy;
- его локальные поля остаются такими, какими их ввёл пользователь;
- Retry строит новый immutable candidate поверх актуального server config;
- success toast не показывается; показывается существующая локализованная
  ошибка;
- если диалог закрыт пользователем, он не создаётся заново.

Rebind сохраняет порядок безопасности файлов: copy допустим до config save,
cleanup — только после acceptance. Оставшаяся после reject копия безвредна и
остаётся вне скоупа housekeeping.

### 4. Routes/maps

Добавление, переназначение и удаление `map_routes` продолжает использовать
атомарный `persistRoutes()` из #441. #442 не возвращает эти операции к общему
debounce и не создаёт второй route writer.

Основной Save устройства обязан переносить текущий vacuum block в candidate,
не стирая уже принятую route transaction. Ошибка основного Save откатывает его
полный candidate к состоянию непосредственно перед попыткой, а не к снимку до
последней успешно принятой route-операции.

### 5. Запись калибровки

`_vacSaveMatrix()` становится асинхронной атомарной операцией либо делегирует
такой операции. Она:

1. строит отдельный config candidate;
2. материализует минимальный marker в candidate для first-use vacuum, не
   изменяя previous config;
3. записывает matrix в exact route/legacy target через существующий
   `writeVacuumMatrix()`;
4. фиксирует optimistic attempt, присваивает candidate и перестраивает preview;
5. ожидает `_saveConfigNow()`;
6. возвращает success только после server acceptance;
7. при reject выполняет guarded rollback, перестраивает devices и возвращает
   failure вызывающему UI.

### 6. Calibration UX

Для low-residual auto-calibration Device editor остаётся на экране. На время
записи соответствующие calibration controls busy/disabled; повторный клик не
создаёт второй запрос. `vac.autocal_done` появляется только после acceptance.
При reject диалог остаётся открыт, busy снимается, показывается ошибка; Retry
повторно использует тот же пользовательский вход и снова рассчитывает matrix.

Для high-residual proposal:

- Apply не очищает `_vacCalConfirm` до ответа;
- proposal получает busy state, закрытие, Cancel, Fit и повторный Apply на это
  время недоступны;
- success закрывает proposal и показывает `vac.autocal_done`;
- reject оставляет тот же proposal/matrix открытым, снимает busy и позволяет
  Retry либо переход в ручную подгонку.

Для manual fit:

- Save не очищает `_vacFit` до ответа;
- overlay получает busy state; drag, rotate/mirror, Save и выход, который мог бы
  потерять draft, на время запроса не создают новую попытку;
- success закрывает overlay и показывает `vac.cal_done`;
- reject оставляет exact `FitParams` и route identity, снимает busy, возвращает
  accepted config и позволяет Retry без повторной подгонки.

Обычный Cancel до начала записи сохраняет прежнее поведение. Нового
предупреждения при ошибке не добавляется.

## Данные и совместимость

- Persisted schema, marker/vacuum shape и revision protocol не меняются.
- Миграции данных нет.
- Успешные marker, route и calibration payloads должны быть эквивалентны
  текущим после canonicalization.
- Legacy calibration и explicit `map_routes` сохраняют контракт #162/#443.
- First-use write сохраняет остальные принятые поля marker: clone-and-patch не
  удаляет неизвестные/future поля marker, config или vacuum.

## Touch, клавиатура и доступность

Busy является настоящим disabled-состоянием controls, а не только визуальным
индикатором. Повторные touch/click/Enter не создают дополнительный Save.
Focus остаётся в том же открытом dialog/overlay после reject. Закрытие через
Esc/scrim во время уже начатой попытки не воскрешает UI после ответа и не
мешает config rollback. Новых targets, жестов и строк i18n нет.

## Ошибки и крайние случаи

| Случай | Ожидаемое поведение |
|---|---|
| controls cycle отклонён backend | marker в View прежний, draft dialog сохранён, Retry доступен |
| invalid light/value source отклонён | тот же guarded rollback без частичного marker |
| route calibration отклонена | accepted matrix остаётся в config, новая fit/proposal остаётся UI-draft |
| first first-use vacuum calibration отклонена | synthetic marker не остаётся локально |
| повторный Save во время pending | один `config/set` |
| conflict reload во время reject | server truth выигрывает, старый rollback no-op |
| новая локальная правка поверх candidate | новая content revision выигрывает |
| Esc закрыл Device editor в полёте | config восстановлен, dialog не воскрешён, error toast виден |
| config принят, layout update не удался | config не откатывается и не расходится с сервером |
| route CRUD #441 reject/retry | прежний атомарный UX остаётся зелёным |

## Acceptance criteria и доказательства

### AC1. Основной Save атомарен

Unit/contract test доказывает, что `_saveMarker()` строит отдельный candidate и
при semantic reject восстанавливает весь previous config/fingerprint. Browser
smoke отклоняет `controls` или другой реально валидируемый field, сверяет View,
сохранённый dialog draft, busy=false и успешный Retry.

### AC2. Откат не затирает владельца новой ревизии

Unit покрывает обычный reject, conflict reload, заменённый root и более новую
in-place правку того же candidate. Mutant с unconditional rollback и mutant,
который пропускает fingerprint для same identity, обязаны краснеть.

### AC3. Main Save отделяет durable config от side effects

Test double принимает `config/set`, затем отклоняет layout/file operation.
Принятый marker остаётся локально, старый config не восстанавливается, а
операция не показывает `toast.marker_saved` до завершения обязательной части
успешного пути.

### AC4. Auto-calibration ждёт сервер

Browser smoke держит `config/set` deferred: до resolve отсутствует success,
Device editor/proposal остаётся открыт и busy, повторный Apply не пишет второй
раз. Resolve закрывает нужный UI и даёт ровно один success toast.

### AC5. Reject auto proposal сохраняет Retry

High-residual proposal при reject остаётся с той же matrix/route identity,
accepted config восстановлен, busy снят и второй Apply может успешно записать
ровно одну калибровку.

### AC6. Reject manual fit сохраняет подгонку

Browser smoke фиксирует изменённые `FitParams`, отклоняет Save и проверяет:
overlay не закрыт, параметры не изменились, pointer/кнопки снова доступны,
config вернулся к accepted matrix. Retry success закрывает overlay и только
тогда показывает `vac.cal_done`.

### AC7. First-use и route identity сохранены

Тест отклоняет первую калибровку auto-discovered vacuum: minimal marker не
остаётся в `_serverCfg`. Существующие multifloor/first-use tests подтверждают,
что successful retry пишет matrix в exact route и не возвращает legacy path.

### AC8. #441 не регрессировал

`smoke_vacuum_route_draft` продолжает доказывать atomic add/reassign/delete,
reject/retry и отсутствие пустого route draft в persisted config. Основной
marker Save не стирает только что принятую route transaction.

### AC9. Общие гейты

Зелёные typecheck, unit, build и синхрон трёх bundle trees. Для diff в `src/**`
обязателен `check-docs`; `smoke-select` определяет дополнительные browser
scenarios. Полный Linux HA harness остаётся каноническим CI. Изменение не
трогает геометрию, поэтому `model-invariants` неприменим. Visible busy/reject UX
проверяется smoke; постоянный golden добавляется только при наличии подходящей
canonical surface.

## План тестирования

- расширить `test/serialized-write-queue.test.mjs` проверкой same-identity
  content change;
- выделить pure candidate/rollback helpers для marker и calibration там, где
  это уменьшает stateful browser setup;
- добавить browser smoke rejected marker Save + preserved draft + Retry;
- расширить vacuum smoke deferred/rejected auto proposal и manual fit;
- сохранить зелёными `smoke_vacuum_route_draft`, `smoke_vacuum_firstuse`,
  `smoke_vacuum_multifloor`, `smoke_vacuum` и `smoke_dialog_zombie`;
- добавить mutation-gate anchors для отсутствующего marker/calibration
  rollback, раннего success/close и same-identity fingerprint guard;
- выполнить `typecheck`, `npm test`, `build`, `bundle:sync`, `check-docs`,
  выбранные smokes и обязательный CI на exact SHA.

## Карта реализации

- `src/serialized-write-queue.ts` — строгий guarded rollback при изменённом
  content того же object identity;
- `src/houseplan-editor-runtime.ts` — immutable marker/calibration candidates,
  async persistence, rollback/rebuild и delayed success/close;
- `src/houseplan-card.ts` — типы busy-state, render/disabled contract и async
  delegates;
- при необходимости небольшой отдельный pure-модуль marker candidate, чтобы не
  раздувать editor runtime;
- `test/`, `demo/smoke_*.mjs`, `scripts/mutation-gate.mjs` — witnesses;
- `docs/CONFIG-COMPATIBILITY.md`, `docs/VACUUM.md`, оба changelog и screenshot
  fingerprint — release artifacts.

## Риски и rollback

- Главный риск — откатить authoritative conflict reload или более новую правку;
  закрывается revision + unconditional content-fingerprint guard.
- Второй риск — принять config на сервере, затем ошибочно вернуть локально
  previous из-за layout/file failure; закрывается явной durable boundary.
- Третий риск — потерять first-use marker либо route identity при clone; его
  закрывают first-use и multifloor witnesses.
- Четвёртый риск — закрыть calibration UI до реального ответа и потерять draft;
  закрывается deferred/reject/retry smoke.
- Rollback реализации — revert frontend/tests/docs/bundle. Data migration нет;
  принятые marker/calibration payloads совместимы с предыдущей версией.

## Release-артефакты

- В том же user-visible implementation commit обновляются
  `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #442.
- `docs/CONFIG-COMPATIBILITY.md` фиксирует: semantic reject marker write не
  остаётся локальной конфигурацией, conflict/newer revision выигрывают.
- `docs/VACUUM.md` фиксирует, что success калибровки означает подтверждённую
  запись, а reject сохраняет auto/manual draft для Retry.
- Любой `src/**` diff требует канонической `Docs screenshots` съёмки и приёмки
  fingerprint по процессу. Если существующий кадр реально меняется, его diff
  просматривается; несвязанные локальные baseline differences не принимаются.
- Новая постоянная golden surface не требуется, если calibration pending/reject
  UI отсутствует в текущей canonical matrix; light/dark и keyboard/touch
  состояние подтверждается browser smoke.
- Нового performance или security artifact не требуется: payload size,
  вычислительная геометрия и trust boundary не меняются.

## Принятые предположения

- Default Q1: в #442 входят только UI-пути, которые могут изменить поля четырёх
  marker semantic validators; generic marker/config writes вне этого множества
  не атомаризируются.
- Default Q2: calibration UI остаётся открытым и busy до ответа; reject
  сохраняет рассчитанный draft для Retry, success закрывает UI после acceptance.
- Любой reject semantic marker attempt откатывает только эту попытку; conflict
  reload и более новая revision/content имеют приоритет.
- Draft основного Device editor живёт отдельно от `_serverCfg` и не теряется при
  rollback.
- Backend/schema/i18n, успешный View и физическая геометрия не меняются.
- Файлы, скопированные перед rejected rebind, остаются безопасным остатком и не
  удаляются новой клиентской гонкой.
