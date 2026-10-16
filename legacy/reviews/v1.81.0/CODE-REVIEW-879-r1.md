# CODE-REVIEW-879-r1

Issue: #879 · Этап: code · Трек: ask · Заход: r1 · блокирующих циклов 0/4
Материал: `8ec263cfff5929d6ac8442f9a03e0b76ababeeed` (ветка `issue/879-intentional-room-placement`, база `dev` `2ac061ac3b83891cc1708d3c4773b3bd2c41e541`)
Спек-ревью: зелёный, r1 (`docs/reviews/SPEC-REVIEW-879-r1.md`), High 0 / Medium 0.

## Скоуп

Новая комната (обычное рисование, Split через `_commitRoom`, пакетное создание
из граней стен через `_applyWallFaceBatch`), привязанная к HA Area при
сохранении, автоматически получает уже существующие устройства этой зоны —
они больше не помечаются красной точкой «новое» исключительно из-за этого
первичного размещения. Исключение ограничено конкретным Save/снимком ID
(K1–K6 ТЗ), не трогает discovery, группировку, скрытие, деактивацию,
HA Area-relocation, миграцию или old-marks cleanup — всё это в явном
не-скоупе ТЗ и не затронуто диффом.

Изменённые файлы класса A: `src/room-device-discovery.ts` (новый, конечный
Save-scoped ledger), `src/houseplan-card.ts` (`_maybeRebuildDevices` принимает
опциональные `createdRooms`, `_syncNewDevices` исключает «ожидающие» ID),
`src/houseplan-editor-runtime.ts` (оба пути создания комнаты передают
`createdRooms`; `_writeConfig` бандлит baseline `known_devices` в тот же
`config/set`, что и комнату, принимает/отклоняет его вместе с записью).
Класс B: новый demo-смок, инвентаризация `coordinate-write-barrier-guard.mjs`,
два новых мутанта в `mutation-registry.mjs`, запись в `smoke-links.mjs`.
Класс C: `FILTERING.md`, `USER-GUIDE.md`/`.ru.md`, `ARCHITECTURE.md`,
`DEVELOPMENT.md`, оба `CHANGELOG`, `docs/release-ledger/v1.80.1/879.json`.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/38411370691) —
`tsc --noEmit`, `npm test`, `npm run build` не перегонялись повторно сверх
точечной проверки ниже. По AC и диффу (геометрия + lifecycle устройств)
прогнано самостоятельно, не только со слов автора:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck/build (точечно) | `npm run build` | GREEN (включает `tsc --noEmit`) |
| Unit, новый файл | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/room-device-discovery.test.mjs` | 7/7 GREEN |
| Негативная проба (умеет падать) | временно убрана проверка `valid()` из `pendingIds()` → тот же набор тестов | 6/7, упал тест «AC3/5: missing/unbound/ambiguous…» — подтверждает, что тест ловит регрессию защиты; откат патча, повторный прогон GREEN |
| Мутационные якоря зарегистрированы | `node scripts/mutation-gate.mjs --check` | `ok room-placement-capture-disconnected`, `ok room-placement-baseline-not-sent` (прогон самих мутантов — не гейт разработки, #709) |
| Контракт транспорта | `node --test test/coordinate-canonicalization.test.mjs`, `node scripts/coordinate-write-barrier-guard.mjs` | GREEN |
| Диффовый отбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 3 «зарегистрированная связь» (`smoke_room_device_discovery`, `smoke_new_device`, `smoke_area_relocation`) — прогнаны ниже; 50 «прямое совпадение» — автор прогнал их в составе `gate:small --smokes` (107/108 GREEN, один известный несвязанный flake → #880), сам выборочно перепрогнал 2 представительных |
| Целевой демо-смок (AC1–AC4) | `npm run bundle:sync && node demo/smoke_room_device_discovery.mjs` | GREEN, все 8 сценариев (batch/ordinary/multi/cancel/undo-before-write/reject/delayed/reload-layout-failure) |
| Регрессия соседнего discovery (AC5) | `node demo/smoke_new_device.mjs` | GREEN |
| Регрессия Area-relocation (AC5) | `node demo/smoke_area_relocation.mjs`, `node demo/smoke_area_relocation_safety.mjs` | GREEN |
| Выборочная проверка «прямого совпадения» | `node demo/smoke_discovery_filters.mjs`, `node demo/smoke_cold_view_toggle.mjs`, `node demo/smoke_wall_face_room_split.mjs` | GREEN |

Не проверял: `golden:verify` (нет `ci:golden`, диффа в рендере нет — подтверждено
чтением: только DOM-класс `.newdot`/данные, не отрисовка), `pytest
tests_backend` (диф не трогает Python), `npm run invariants` (геометрический
алгоритм не менялся — только метаданные `settings`), performance (не назван в
AC, диффа в проходе по геометрии нет). Полная матрица демо-смоков (318) —
предрелизный гейт, не гейт ревью; доверился авторскому прогону
`gate:small --smokes` (107/108, единственный провал воспроизведён на
неизменённом `dev` и заведён отдельно как #880) и перепроверил часть выборки
сам, как указано в таблице. После собственных прогонов рабочая копия
восстановлена (`npm run bundle:clean`); `git status` — чисто, SHA не менялся.

## Разбор по AC

- **AC1** (видимость без точки, обычное и пакетное создание). Код:
  `_commitRoom`/`_applyWallFaceBatch` передают `createdRooms` в
  `_maybeRebuildDevices`, которая вызывает `RoomDeviceDiscovery.capture()` до
  `_syncNewDevices()`. `capture()` фильтрует по `auto()` (без `marker`/`virtual`),
  исключает ID, уже бывшие «авто» до рестройки, требует совпадения
  `space`+`area` с именно этой комнатой и `bindingStatus` не хуже `active`.
  Проверено исполнением: smoke `batch`/`ordinary`/`multi` — `noNewDot`,
  `notNew`, `groupNotNew` (группа света), `catalogNotNew` все `true`;
  `secondRoomQuiet` подтверждает независимость при нескольких комнатах за
  один Save. Защита (чем краснеет): мутант `room-placement-capture-disconnected`
  (guard — тот же demo-смок) в реестре.
- **AC2** (старые `new_device_ids` не теряются, поздний ID — обычное внимание).
  Unit-тест «AC1/2/5» и «AC2/4/6» проверяют совпадающий ID (`'same'`) и явно
  существовавшую метку (`'attention'`) после `accept()`; smoke `delayed`
  проверяет исполнением, что устройство, появившееся в HA во время ожидания
  ответа `config/set`, получает `.newdot` и флаг, а исходное — нет
  (`firstQuiet`/`lateFlagged`/`persistedBoth`).
- **AC3** (Cancel/Undo/отказ/conflict не создают тихий baseline, ретрай
  работает). Smoke `cancel`, `undo-before-write`, `reject` проверяют
  исполнением реальные кнопки/Undo-тулбар/`config/set`-reject с
  `code: 'conflict'`; `reject.retryQuiet` подтверждает, что повторная попытка
  после отказа снова корректно размечает устройство тихим. Негативный unit
  («AC3/5») гоняет 4 сценария потери валидности (комната удалена/без Area/
  Area задублирована/ID комнаты заменён) — все обнуляют `pendingIds`.
- **AC4** (reload и второй клиент не выставляют точку заново; сбой layout не
  откатывает принятую комнату). Smoke `reload-layout-failure`: принудительный
  отказ `layout/update`, затем `_reloadConfigOnly(true)` на исходной карточке
  (`reloadQuiet`) и чтение того же сохранённого конфига новым экземпляром
  `<houseplan-card>` в режиме чтения (`secondQuiet`, `readerNoWrites` — второй
  клиент не пишет). Baseline и комната отправлены одним `config/set`
  (`atomicPayload` в `outcome()`, плюс отдельный unit «актуальный сериализованный
  writer»). Защита: мутант `room-placement-baseline-not-sent`, guard —
  исполняемый unit с `--test-name-pattern="#879 AC1/3/4"`.
- **AC5** (relocation, ручные/виртуальные маркеры, скрытые/деактивированные,
  молчаливый baseline, неавторизованный клиент не пишет). Unit «AC1/2/5»
  явно перебирает `manual` (marker), `virtual`, `disabled` (`ha_disabled`),
  другой этаж, другую Area — ни один не попадает в `pendingIds`.
  `smoke_area_relocation.mjs`/`smoke_area_relocation_safety.mjs` зелёные без
  изменений — реальный перенос между Area и его тревоги/ретраи не задеты.
  `reload-layout-failure.readerNoWrites` — второй, read-only клиент не пишет.
- **AC6** (документация, типы, без новых полей/i18n/миграции/геометрии).
  `FILTERING.md`, `USER-GUIDE.md`/`.ru.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`,
  оба `CHANGELOG`, `release-ledger/v1.80.1/879.json` обновлены тем же коммитом;
  терминология («красная точка», «новое») соответствует формулировкам, уже
  принятым в `USER-GUIDE.ru.md`. Новых config-полей, capabilities, i18n-ключей
  нет (проверено чтением диффа — единственное новое поле уровня данных это
  использование существующих `known_devices`). `coordinate-write-barrier-guard.mjs`
  и обновлённый тест `coordinate-canonicalization.test.mjs` держат транспорт
  `config/set` как единственный зарегистрированный способ записи — исполнением
  подтверждено (см. таблицу гейтов).

## Находки

Находок уровня High/Medium нет.

Low (не блокирует, можно поправить при следующем прикосновении к файлу или
оставить): `RoomDeviceDiscovery.valid()` в `capture()` (room-device-discovery.ts:15)
дублирует проверку, которую `pendingIds()` всё равно выполняет над тем же
`this.placements` при каждом вызове (room-device-discovery.ts:24) — убедился
экспериментально, что отключение проверки внутри `capture()` не меняет
поведение ни одного теста, потому что `pendingIds()` сам вычищает
невалидные записи. Поведенческого дефекта нет, просто одна из двух проверок
избыточна.

## Что проверено и корректно

- Разделение путей: только `_commitRoom` (включая Split, явно задокументированный
  в USER-GUIDE как часть исключения) и `_applyWallFaceBatch` передают
  `createdRooms`; все остальные ~30 вызовов `_maybeRebuildDevices()` в кодовой
  базе (merge комнат, `config-reload-authority`, `led-strip-editor`,
  `vacuum-calibration-write`, `space-copy-runtime`, `plan-optimize-write` и т.д.)
  не изменились и не захватывают новые placements — проверено `grep` по всем
  вызовам и типом параметра (опциональный, обратная совместимость).
- `_canEdit` (`_norm && _canManageConfiguration`) гейтит `capture()` — View/kiosk
  и read-only сессии не создают intent (K6).
- Атомарность: `prepare()` кладёт `known_devices` в тот же объект `config`,
  что уходит в `_sendConfigCandidate`; `accept()`/`reject()` вызываются из
  одного и того же `try/catch` вокруг фактической сетевой записи —
  подтверждено исполнением (unit «актуальный сериализованный writer» и
  demo-смок `atomicPayload`).
- Конкурентность: `accept()` берёт за основу текущий `live.settings.known_devices`
  (не снимок на момент `prepare()`), так что поздняя локальная правка во время
  ожидания ответа не теряется — unit «AC2/6: delayed actual write» и demo-смок
  `delayed` оба подтверждают это исполнением с реальной debounced записью.
- `reject()`/`accept()` оперируют только `write.placements` конкретной попытки
  (через ссылочное `Set.delete`), а не всем накопленным состоянием — устарелый
  ответ не может поглотить более позднюю независимую запись (unit
  «AC2/4/6: … a stale reply cannot consume a later Save»).
- Проверил опасение по согласованности `_adoption.configFingerprint` и живого
  `host._serverCfg` в окне между `acceptConfigWrite(discoveryWrite.config, …)`
  и последующим `accept()` (который патчит `host._serverCfg.settings` на
  месте): между этими двумя вызовами нет `await`, они выполняются в одном
  синхронном продолжении, и смок `delayed` воспроизводит ровно конкурентный
  случай без расхождения. Не нашёл воспроизводимого сценария рассинхронизации
  в рамках ревью; отдельно не завожу.
- Релиз-леджер: `stable-fix` относительно `v1.80.1` обоснован — дефект
  (`_syncNewDevices` не отличает намеренное первичное заполнение от discovery)
  существует в уже опубликованном `v1.80.1`, формат и поля совпадают с
  соседними `stable-fix` записями (`836.json`, `842.json`, `864.json`).
- Трейлеры коммита: `Issue: #879`, `User-Visible: yes`; оба `CHANGELOG`
  правлены тем же коммитом. Одно число — одна точка сохранения: красная точка
  «новое» — единственное видимое изменение, источник один (`settings.new_device_ids`
  через `_syncNewDevices`), без дублирования в другом месте рендера.

## Чего не проверял

- Полную матрицу demo-смоков (318 файлов) и полный `gate:small --smokes` сам
  не перегонял — положился на авторский прогон (107/108 GREEN, разбор
  единственного провала как несвязанного и заведённого в #880) плюс
  собственный точечный повтор 3 зарегистрированных и 3 «прямого совпадения»
  смоков из таблицы выше.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`, performance —
  не прогонял: нет визуального рендер-диффа, Python не менялся, геометрический
  алгоритм не менялся, производительность не названа в AC (см. «Как проверялось»).
- Поведение при реальном HA backend (`custom_components/houseplan`) и фактическую
  семантику WS-broadcast при `config/set` (приходит ли эхо собственной записи
  раньше RPC-ответа) не исследовал на уровне Python/проде — рассуждение в
  разделе «Что проверено» ограничено тем, что воспроизводимо в demo-гарнале.

## Вердикт

Зелёный. AC1–AC6 доказаны исполнением (unit + демо-смоки, включая негативные
случаи и зарегистрированные мутационные якоря для двух защитных путей),
документация и changelog обновлены вместе с кодом, release ledger корректен,
посторонних путей `_maybeRebuildDevices` исключение не задевает. Единственная
находка — Low, не блокирует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/879-intentional-room-placement`, коммит `8ec263cfff59` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0cc09ecb8dd66e5dc901774c2641343d115b537a`
  ```
  git log --all --format='%H %T' | grep 0cc09ecb8dd6
  ```
- Тело issue: `554ee69338aae657a681d1e2db8c2695dda7ff06d7d30b868b0b73a3ce1ea323`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNzcsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzUyMDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDQsIm91dHB1dF90b2tlbnMiOjUwMTIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NDQ1MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjg5OTI3ODQsImNvc3RVc2RFc3RpbWF0ZSI6Mi45NTc4NzQ4fV0sInR1cm5zIjo3OCwiZHVyYXRpb25NcyI6ODIwOTc2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi45NjIyMjY4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4421 output_tokens=50138 cache_creation_input_tokens=164450 cache_read_input_tokens=8992784 num_turns=78 -->
