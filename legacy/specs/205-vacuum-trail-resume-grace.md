# Issue #205 — продолжение следа после короткой остановки пылесоса

- Дата: 2026-08-19
- Тип: bug · приоритет P1
- Оценка: пользовательская ценность 7/10 · ценность для разработки 5/10 · сложность 4/10 · риск 7/10
- Issue: [#205](https://github.com/Matysh/houseplan-card/issues/205)
- Ветка: `issue/205-vacuum-trail-grace`

Канонические документы: `docs/SCOPE.md`, `docs/VACUUM.md`,
`docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Владелец робота со станцией запускает уборку этажа. Робот несколько раз
возвращается на док промыть швабры, выгрузить мусор либо ожидает после Pause, а
затем продолжает то же задание на той же карте. Владелец ожидает видеть один
накопленный след всей уборки, а не только путь после последнего визита на базу.

## 2. До и после

**До:** любой доступный non-moving state немедленно завершает `current`.
Следующая точка безусловно начинает новый run. В default-режиме `cleaning`
предыдущая часть вообще не рисуется; в `always` она становится полупрозрачной,
а второй визит на док вытесняет самый ранний кусок из one-deep `previous`.

**После:** остановка по-прежнему скрывает след в режиме `cleaning`, но новая
точка на той же карте в течение 30 минут возобновляет тот же `current`: старые и
новые points остаются одним путём. Более долгая остановка или смена карты
создаёт новый run как раньше.

## 3. Подтверждённая причина

`TrailRecorder._sample()` вызывает `TrailBook.end_run()` для любого state вне
`cleaning`, `returning`, `on`. `end_run()` записывает epoch timestamp в
`current.ended`. `TrailBook.on_point()` трактует любое truthy `ended` как
безусловную границу и ротирует `current → previous` независимо от длительности
остановки и `map_id`.

Переход станции `cleaning → returning → docked → cleaning` поэтому всегда
разрывает run. Механизм vendor-neutral и затрагивает также `paused`, `idle`,
краткий `error` и неизвестные доступные состояния. `unavailable`, `unknown` и
отсутствие state уже нейтральны и сами run не завершают.

## 4. Scope

- ввести backend-константу resume grace ровно 30 минут;
- научить pure `TrailBook.on_point()` возобновлять ended current при той же карте
  и `now - ended <= grace`;
- сохранить мгновенный `end_run()` и скрытие default trail во время остановки;
- жёстко разрывать run при другой карте и после grace;
- применять правило ко всем доступным non-moving states без vendor dialect;
- сохранить Store format, decimation/cap, one-deep previous и event/save wiring;
- покрыть pure book, recorder sequences, restart persistence и card rendering.

## 5. Non-scope

- Tasshack/Dreame-specific атрибуты `washing`/`drying`/`emptying`;
- task/session id, эвристики по координатам, площади, названию комнаты или
  integration path;
- настройка длительности grace в UI/config и отдельное предупреждение;
- хранение более двух runs, склейка уже разорванной legacy history или миграция
  Store;
- изменение `MOVING_STATES`, puck visibility, calibration, path thinning,
  `trail_mode` или приоритета integration/server/local paths;
- изменение source health monitor и semantics unavailable/unknown.

## 6. Контракт run lifecycle

Пусть `TRAIL_RESUME_GRACE_S = 1800` и current имеет числовой `ended`.

1. Новая валидная point при совпадающем `map_id` и
   `0 <= now - ended <= 1800` снимает `ended` (`None`) и дописывается в тот же
   `points`; `started` не меняется, `previous` не создаётся и не меняется.
2. Ровно на границе 30:00 run продолжается. При `now - ended > 1800` создаётся
   новый current с `started = now`, старый current становится previous.
3. Несовпадающий `map_id` всегда начинает новый run независимо от времени.
4. Если первая point после resume совпадает с последней сохранённой, дубль не
   добавляется, но снятие `ended` всё равно считается изменением: state должен
   быть сохранён и событие обновления отправлено.
5. Отрицательная/нечисловая/неfinite разница либо malformed persisted `ended`
   не даёт права на resume и безопасно начинает новый run. Legacy `ended:null`
   остаётся активным run.
6. Повторные non-moving samples не сдвигают начало окна: idempotent `end_run()`
   сохраняет timestamp первого подтверждённого stop.
7. `unavailable`, `unknown` и отсутствие vacuum state не вызывают `end_run()`,
   не снимают `ended` и не сдвигают timestamp. Если до них был подтверждённый
   stop, окно продолжает идти по wall clock.
8. Любой доступный state вне `MOVING_STATES` использует один контракт — тип
   остановки не сохраняется и не влияет на решение.

Неизбежный trade-off принят владельцем: если интеграция не даёт task id, две
реально разные уборки на той же карте, начатые в пределах 30 минут, могут
визуально склеиться. Не добавлять нестабильные эвристики для их угадывания.

## 7. Persistence, рестарт и frontend

Store version и shape не меняются: epoch `ended`, `started`, `map_id` и points
уже сохраняются. После рестарта HA `TrailBook` читает timestamp и принимает то
же решение по реальному elapsed time. Отдельный timer не нужен.

Пока robot non-moving, recorder сохраняет ended current, карточка в
`trail_mode:'cleaning'` скрывает line как сейчас. После resume backend отдаёт
тот же current с `ended:null` и полным points; frontend не склеивает runs и не
получает новой ветки. В `always` возобновлённый current возвращается к обычному
current style, а existing previous (если был до этого задания) остаётся тем же.

## 8. UX, accessibility, i18n и compatibility

Новых controls, текстов, notifications и locale keys нет. Визуально меняется
только целостность уже включённого следа. Reduced motion, theme, touch,
keyboard и screen-reader semantics не затрагиваются.

Старые Store records читаются без миграции. Downgrade снова разорвёт следующий
ended run, но данные останутся валидны. Delete trail, marker removal,
multi-floor source fan-out и map-id normalization не меняются.

## 9. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | `cleaning → docked 10 min → cleaning` на той же карте даёт один current со всеми points и без нового previous. | Pure `TrailBook` + recorder pytest. |
| AC2 | Pause ровно 30:00 продолжается; 30:00 + epsilon создаёт новый run. | Boundary pytest with explicit timestamps. |
| AC3 | Смена `map_id` внутри grace всегда ротирует current → previous. | Pure map matrix. |
| AC4 | Resume с дубликатом последней point снимает ended, не добавляет point и возвращает changed=true. | Focused pure test. |
| AC5 | Два и более коротких dock/pause цикла не теряют ранние points и не вытесняют existing previous. | Sequence regression. |
| AC6 | `unavailable`/`unknown`/missing остаются нейтральными; repeated stop не продлевает grace. | Recorder pytest. |
| AC7 | Persisted ended run после реконструкции `TrailBook` возобновляется/разрывается по тому же окну; malformed timestamps fail closed. | Store-shaped pure tests. |
| AC8 | Default card после resume рисует полный current; во время dock скрывает его. `always` сохраняет правильные current/previous styles. | Targeted production-bundle vacuum smoke with server payload. |
| AC9 | Source health, two-floor fan-out, cap/decimation, delete and map-id suites остаются зелёными. | Existing backend tests. |
| AC10 | Старое unconditional rotation ловится мутантом. | Mutation gate with focused pytest guard. |
| AC11 | Рабочие gates зелёные. | typecheck, unit, build, targeted smoke, `pytest tests_backend`; Linux HA harness in CI. |

## 10. План реализации и тестов

Минимальная реализация живёт в `custom_components/houseplan/trails.py`: константа
и узкая pure-проверка resume в начале `TrailBook.on_point()`. Сначала жёстко
обрабатывается map mismatch; затем допустимый ended current открывается снова;
иначе сохраняется нынешняя rotation. Возвращаемый `changed` объединяет факт
resume и факт append, чтобы duplicate-point case всё равно дошёл до Store/event.

`tests_backend/test_trails.py` получает таблицу grace/map/malformed/duplicate и
multi-stop. `tests_backend/test_trail_recorder.py` воспроизводит state sequences,
neutral states и restart-shaped book. `demo/smoke_vacuum.mjs` либо отдельный
targeted scenario доказывает frontend payload contract без vendor API.

Mutation entry возвращает условие `if cur.get('ended')` к безусловной rotation;
focused backend guard обязан стать красным. Локально запускается полный доступный
`python -m pytest tests_backend -q`; если Windows `fcntl` блокирует HA harness,
фиксируется чистый pure/stub subset, а канонический полный результат берётся из
Linux CI согласно `PROCESS.md`.

Golden не нужен: path continuity проверяется SVG path/points численно. Full
smoke/golden/performance выполняется перед бетой.

## 11. Риски и меры

| Риск | Мера |
|---|---|
| Две реальные уборки склеятся | Принятый 30-минутный предел; map switch всегда hard boundary. |
| Repeated dock продлевает окно бесконечно | `end_run()` не переписывает truthy ended. |
| Duplicate point не сохранит resume | Changed=true при снятии ended, AC4. |
| Рестарт изменит решение | Epoch timestamp из Store, без process-local timer, AC7. |
| Vendor state не покрыт | Единое правило для всех available non-moving states. |
| Backend исправлен, card теряет старые points | Payload/render smoke AC8. |

Проверка на point — O(1); асимптотика и cap не меняются. Security/privacy
boundary прежний: новых данных, логов, сетевых запросов, permissions и services
нет.

## 12. Release-артефакты и rollback

Изменение пользовательское. Implementation-коммит имеет `User-Visible: yes` и
включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #205;
- `docs/VACUUM.md` и `docs/USER-GUIDE.ru.md` — 30-минутный resume contract и
  trade-off;
- `docs/TESTING.md` — backend sequence/boundary/restart coverage;
- `docs/STATUS.md` — фактическую release-линию;
- backend tests, targeted frontend smoke, mutation entry и синхронные bundle
  copies, если build меняет tracked bundles.

Отдельные schema/migration, i18n, screenshot/golden, security и performance
артефакты не нужны. Rollback — revert implementation-коммита; Store совместим,
но следующие короткие остановки снова начнут новые runs.

## 13. Принятые предположения

1. Grace считается по переданному `now` и сохранённому epoch `ended`; clock
   rollback fail-closed и не возобновляет run.
2. Константа module-level, без конфигурации; точное имя helper техническое.
3. Existing `previous` не меняется при resume current; только настоящий новый
   run заменяет его по нынешнему one-deep контракту.
4. Vendor-specific fast-path откладывается до отдельной задачи с diagnostics
   fixture.
5. Продуктовых вопросов больше нет: Q1–Q4 приняты владельцем по defaults.
