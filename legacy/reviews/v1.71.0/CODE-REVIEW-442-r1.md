# CODE-REVIEW-442-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/442
- Этап: code (PROCESS.md §2.7)
- Заход: r1 (первый код-ревью цикл; спек-ревью r1 уже зелёный)
- Ветка: `issue/442-marker-write-rollback`, HEAD `ffbf8242abf441196f731012f454f850c102dfaa`
- ТЗ: `docs/specs/442-marker-write-rollback.md` (принято зелёным на SHA `a8426268`)
- Диапазон: `git diff origin/dev...HEAD` — 40 файлов, +1732/-459 (без учёта `dist/**`,
  `custom_components/houseplan/frontend/**` — class D, не проверяется построчно,
  проверена побайтовая идентичность с пересобранным `dist`)

## Скоуп

Атомарный immutable candidate + guarded rollback для трёх путей, которые могут
задеть четыре marker semantic validators: основной Save устройства
(`_saveMarker`), запись матрицы калибровки робота (`saveVacuumMatrix` /
`_vacSaveMatrix`), три сценария calibration UX (low-residual auto, high-residual
proposal, manual fit). Плюс отдельная граница durable config acceptance vs
layout/file side effects, и более строгий `rollbackOptimistic` guard (сравнение
content по фингерпринту обязательно даже при совпадении object identity, #442
AC2). Не в скоупе, и диффом не тронуто: 18 generic `_saveConfig()` вызовов
(Hide/Show, discovery seeding, обычные vacuum-настройки), общий settings-путь
`_saveSettingsDialog` (#439), backend/schema/i18n, геометрия, маршрутизация
карт кроме сохранения уже готового `persistRoutes()` (#441).

## Как проверялось

**Дешёвые гейты (прогнаны сам, зелёного Validate на этом SHA не было):**

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green, 0 ошибок |
| `npm test` | 1863 pass, 1 skip, 0 fail (`# tests 1864`) |
| `npm run build` | green; `git status --porcelain` после билда пуст — dist воспроизводится байт-в-байт |
| `npm run bundle:sync` | green; SHA-256 `dist/houseplan-card.js` и `houseplan-assets.json` совпадают с `custom_components/houseplan/frontend/**` |
| `node scripts/check-docs.mjs` | green: «Documentation checks passed (7 files, 10 external links)» — diff трогает `src/**`, поэтому обязателен |

**Инварианты модели:** неприменимо — diff не трогает рёбра комнат, толщину,
`layout`, `marker.space`/`open_spans`; единственная геометрическая функция
(`canonicalizeConfigGeometry`) не изменена, только обёрнута в
`_prepareConfigCandidate` без изменения поведения (подтверждено чтением и
`npm test`, включая `#278`/`#224`-серии).

**Mutation witnesses (`scripts/mutation-gate.mjs --id=<id>`), каждый
запущен лично и подтверждён как «покраснел, как обязан»:**

| id | guard | Что проверяет |
|---|---|---|
| `marker-reject-keeps-optimistic-candidate` | `smoke_marker_write_rollback` | AC1: отсутствие `rollbackOptimistic` красит смок |
| `marker-rollback-keeps-enqueue-time-revision` | `smoke_marker_write_rollback` | AC2: без ребиндинга `attempt.revision` смок красит |
| `accepted-marker-rolled-back-by-layout-failure` | `smoke_marker_write_rollback` | AC3: безусловный rollback после accept красит смок |
| `vacuum-reject-keeps-optimistic-matrix` | `test/vacuum-calibration-write.test.mjs` | AC5–AC7: без rollback в `saveVacuumMatrix` тест красит |
| `vacuum-auto-reports-success-before-acceptance` | `test/vacuum-calibration-write.test.mjs` | AC4: ранний `saved=true` до ответа сервера красит тест |
| `optimistic-rollback-skips-same-root-fingerprint` | `test/serialized-write-queue.test.mjs` | AC2: возврат identity-шортката красит тест |

Также перепроверены два **не новых**, но переехавших вместе с рефакторингом
мутанта (`src/houseplan-card.ts`→`src/houseplan-editor-runtime.ts` и
`src/vacuum-calibration-write.ts`): `vacuum-manual-fit-after-proposal-uses-the-dock`
и `child-readd-clears-parent-tombstone` — оба по-прежнему красят целевой
смок/гейт после переноса паттерна. Полный `mutation-gate` без `--id` не
гонялся: он падает на несвязанном `backend-test-guard` (`No module named
pytest`), окружение без Python-гейта — не относится к этой задаче.

**Browser smokes.** `node scripts/smoke-select.mjs --base origin/dev --head HEAD`
насчитал diff по 56 символам на изменённых строках `src/**` (4 файла), матрица
219 смоков, порог «широкого» символа — 43. Инструмент выдал 36 «прямое
совпадение» + 43 «слабая связь» (полный вывод учтён, не прикладываю целиком).

Прогнаны лично (все green), 12 из 36 прямых совпадений плюс AC8:

- `smoke_marker_write_rollback` (новый, AC1–AC3) — все 12 полей `true`
- `smoke_vacuum_firstuse` (расширен, AC4–AC7) — все 23 поля `true`
- `smoke_vacuum_multifloor`, `smoke_vacuum` — `OK`
- `smoke_vacuum_route_draft` (AC8, автор назвал явно) — все 21 поле `true`
- `smoke_dialog_zombie` (автор назвал явно) — все 8 полей `true`
- `smoke_v8_draft_write` — прямое совпадение на `_cfgContentFingerprint`,
  `_cfgRev`, `_dropLegacySegments` (сигнатура которого реально изменилась:
  необязательный параметр `config`), `_saveConfigDebounced` — 16 полей `true`
- `smoke_lattice_write_barrier` — прямое совпадение на `_writeConfig`
  (сигнатура которого реально изменилась: параметр `attempt`) — 9 полей `true`
- `smoke_wall_thickness` — прямое совпадение на `_dropLegacySegments` — 18 полей `true`
- `smoke_save_race` — прямое совпадение на разделяемый writer/`_cfgRev` — 4 поля `true`
- `smoke_danger_confirmation` — прямое совпадение на `_markerDialog`/`_saveConfigNow`
  (сигнатура изменилась: параметр `attempt`) — 18 полей `true`
- `smoke_config_writer` — прямое совпадение на `_cfgRev`/`_saveConfig` — `OK`

Решение по каждой из непрогнанных 24 «прямых совпадений» (`smoke_decor_default_persist`,
`smoke_area_relocation_safety`, `smoke_controls`, `smoke_cover_tap`,
`smoke_device_inbox`, `smoke_device_position_history`, `smoke_device_preview_parity`,
`smoke_discovery_filters`, `smoke_editor_tabs`, `smoke_help_affordance`,
`smoke_optimize_coordinate_canonicalization`, `smoke_partition_openings`,
`smoke_room_resize`, `smoke_room_tooltip_toggle`, `smoke_sun`, `smoke_tap_ctx`,
`smoke_value_face_source`, `smoke_danger_confirm_branches`, `smoke_decor_images`,
`smoke_editor_gestures`, `smoke_fixed_floor`, `smoke_junction_limits`,
`smoke_resize_audit_1550`, `smoke_space_tab_reorder`,
`smoke_zero_wall_migration_unblocked`): не прогонялись. Совпадение у них —
на общие символы (`_cfgRev`, `_showToast`, `_writeConfig`, `_commitSpace`,
`_markerDialog`/`Marker`/`DevItem` как типы), а не на изменённое поведение;
ни один не тестирует Device editor save, calibration UX или rollback guard
напрямую. Сами изменённые функции (`_writeConfig`, `_saveConfigNow`,
`_dropLegacySegments`, `rollbackOptimistic`, `optimisticAttempt`) уже
прогнаны в 6 смоках выше плюс покрыты 1863 unit-тестами, включая
`test/coordinate-canonicalization.test.mjs` (#224-серия, строчная сверка
источника `_writeConfig`) и `test/serialized-write-queue.test.mjs`. Слабую
связь (43 смока) не прогонял — ни один не совпал на изменённом символе,
только на распространённых именах вне контракта записи.

`npm run golden:verify` не гонял — diff не меняет видимый рендер, только
busy/disabled-атрибуты кнопок (`?disabled`, `aria-busy`); `check-docs`
подтвердил 0 изменённых PNG и единственно принятый `sourceFingerprint`
(скриншоты сделаны без калибровочного pending/reject UI, что ТЗ явно
допускает: «Новая постоянная golden surface не требуется»).

`python -m pytest tests_backend` не гонял — diff не трогает
`custom_components/**/*.py`.

Performance-профили не гонял — не названы в AC, diff не меняет
чувствительные к перфу пути (только optimistic write/rollback JS-логику
объёмом O(размер конфига), не в цикле рендера).

## Разбор кода

**`src/serialized-write-queue.ts`.** `rollbackOptimistic` больше не
принимает object-identity как самостоятельное основание для отката —
теперь всегда сравнивается `fingerprint(current) !== attempt.attemptedFingerprint`,
и для той же ссылки тоже. Это именно то, что требует AC2: «более новая
in-place правка не может быть затёрта старым reject». Проверено новым
unit-тестом (`newer in-place content on the attempted root also wins`) и
персонально перепроверенным мутантом `optimistic-rollback-skips-same-root-fingerprint`.

**`src/houseplan-editor-runtime.ts` — `_saveMarker()`.** Строит `candidate`
глубоким клоном `cfg` **до** отправки (`JSON.parse(JSON.stringify(cfg))`),
не мутирует исходный `cfg`. Перед установкой `optimisticAttempt` есть явная
guard-проверка на смену корня во время async file-migrate шага
(`this.host._serverCfg !== cfg || this.host._cfgRev !== baseRevision ||
contentFingerprint(cfg) !== baseContent`) — конфликт корректно показывает
`toast.conflict` и не строит candidate поверх устаревшего root. `attempt`
создаётся, кандидат устанавливается оптимистично, debounce отменяется,
`_saveConfigNow(attempt)` awaited. `configAccepted` выставляется в `true`
**только** после успешного `_saveConfigNow`; catch откатывает
(`rollbackOptimistic`) исключительно если `!configAccepted`. Layout
update/obsolete cleanup/file cleanup идут после этой границы и их отказ не
трогает `configAccepted` — соответствует контракту §1 ТЗ. Подтверждено
чтением и смоком `smoke_marker_write_rollback` (`sideEffectFailureKeepsAcceptedConfig`).

**`_writeConfig(attempt)`.** Новая строка `if (attempt && candidateFingerprint
=== attempt.attemptedFingerprint) attempt.revision = this.host._cfgRev;`
решает реальную гонку: если попытка встала в очередь `_writeChain` позади
другой уже выполняющейся записи, `_cfgRev` к моменту фактической отправки
может уже уйти вперёд, и без ребиндинга guard в `rollbackOptimistic` увидел
бы устаревшую `attempt.revision` и **тихо не откатил** законно отклонённый
кандидат. Мутант `marker-rollback-keeps-enqueue-time-revision`,
удаляющий эту строку, красит `smoke_marker_write_rollback` — сценарий
«queue behind a prior write» там воспроизведён явно (строки 44–56 смока).

**`src/vacuum-calibration-write.ts` (новый модуль).** `saveVacuumMatrix`
клонирует `previous`, находит или материализует minimal first-use marker
на клоне (не на `previous`), пишет матрицу через существующий
`writeVacuumMatrix()`, ставит `optimisticAttempt`, отменяет debounce,
ждёт `_saveConfigNow(attempt)`; на reject — `rollbackOptimistic` +
rebuild + toast. `saveAutomaticCalibration` дедуплицирует параллельные
Apply через `WeakSet<runtime>`, держит `_markerDialog.busy` до ответа,
снимает его в `finally` независимо от исхода. `applyCalibrationProposal`
и `saveManualCalibration` следуют тому же паттерну busy→await→(close+toast
| restore-draft+busy:false). Все четыре пути подтверждены и unit-тестом
(`test/vacuum-calibration-write.test.mjs`, включая проверку `assert.notEqual`
на изолированность отката от live-объекта), и browser-смоком
(`smoke_vacuum_firstuse`), и мутантами.

**`src/houseplan-card.ts`.** Только типизация (`VacuumFit`/`CalibrationProposal`
вместо инлайновых типов) и busy-wiring в разметке: `?disabled=${busy}` на
кнопках Auto-calibrate/Fit/Save/Cancel/Apply, `aria-busy` на диалоге
предложения и панели fit, Esc/scrim guard на `busy`. Согласуется с разделом
«Touch, клавиатура и доступность» ТЗ — busy это реальный disabled, а не
только визуальный индикатор.

## Находки

Ничего блокирующего. Два Low, оба вне обязательного скоупа задачи —
оставлены с запиской, не правятся и не заводятся отдельным issue (severity
ниже Medium, PROCESS.md §12 не требует issue для Low).

1. **Low — `docs/specs/README.md`, таблица раздела «P2».** Новая строка
   `#442` вставлена сразу после `#10`, а не в конце секции, где физически
   находится диапазон номеров `#4xx` (например, `#440`, `#443` идут в
   других местах таблицы). Секция и так не строго монотонна (`#294` после
   `#373`, `#443` после `#434`), так что это чисто косметическая
   навигационная неровность — `check-docs.mjs` не проверяет порядок,
   ссылка рабочая. Не блокирует.

2. **Low/наблюдение, не находка задачи — `_saveSettingsDialog()` (#439,
   `src/houseplan-editor-runtime.ts:10260`, diff этой задачи не трогает).**
   Этот путь по-прежнему вызывает `this._saveConfigNow()` **без** передачи
   `attempt`, поэтому новый ребиндинг `attempt.revision = this.host._cfgRev`
   в `_writeConfig` для него не работает — тот же класс гонки, который #442
   AC2 закрывает для маркеров (запись в очереди позади другой, `_cfgRev`
   ушёл вперёд), теоретически остаётся в settings-пути. Это **не
   регрессия этой задачи**: поведение не менялось, риск существовал уже
   в #439, воспроизведение требует двух параллельных pending-записей и не
   проверено мной в обе стороны в рамках бюджета этого раунда. Settings
   dialog не входит в скоуп #442 (не задевает четыре marker semantic
   validators) и явно исключён ТЗ («атомаризация всех 18 generic
   `_saveConfig()` call sites» — не-скоуп). Оставляю как наблюдение для
   будущей задачи, а не как находку, требующую отдельного issue сейчас —
   недостаточно данных, чтобы утверждать это как подтверждённый дефект, а
   не гипотетический край.

## Что проверено и корректно

- AC1–AC9 — каждый либо доказан автотестом, который я лично прогнал и чьи
  свидетели проверены на способность покраснеть (mutation-gate), либо
  browser-smoke-ом с явными полями результата, все `true`.
- Guarded rollback различает: обычный reject (откатывает), conflict reload
  (не трогает authoritative reload), более новую in-place правку той же
  ссылки (не трогает) — по коду и по unit/smoke сценариям.
- Durable boundary между `configAccepted` и layout/file side effects — по
  коду и by `sideEffectFailureKeepsAcceptedConfig`/`sideEffectFailureHasNoSuccess`
  в смоке.
- First-use synthetic marker не остаётся при reject — unit
  (`rejected first-use calibration leaves no synthetic marker`) и смок
  (`fitFreshNoMarker`, `highResidualRejectRestoresMatrix`).
- #441 (route CRUD) не задет — `smoke_vacuum_route_draft` зелёный целиком,
  основной Save по коду не пишет `map_routes` напрямую (переносит блок
  `vacuum` как есть в кандидат).
- Busy — настоящий disabled на кнопках/полях, Esc/scrim не воскрешают UI
  во время pending — по коду и `smoke_vacuum_firstuse`
  (`autoWaitsBusyDisabled`) плюс ручное чтение `_onKey`/шаблонов.
- Оба changelog обновлены в одном user-visible коммите (`fcd4e3dd`),
  трейлеры `Issue:`/`User-Visible:` корректны на всех 5 коммитах диапазона.
- `docs/CONFIG-COMPATIBILITY.md` и `docs/VACUUM.md` формулировки совпадают
  с фактическим контрактом кода (revision+content guard, durable boundary,
  retry-draft).
- Screenshot provenance (`docs/images/screenshots.json`): только
  `sourceFingerprint` изменился на всех 10 сценариях, все `imageSha256`
  идентичны — реальных визуальных изменений нет, что ожидаемо (только
  busy/disabled-атрибуты, не заснятые в текущей матрице).

## Чего не проверял

- Полный `mutation-gate` без `--id` (падает на несвязанном
  backend-test-guard из-за отсутствия pytest в этом окружении — вне
  диапазона задачи).
- 24 из 36 «прямое совпадение» и все 43 «слабая связь» browser smoke —
  см. таблицу выше с обоснованием по каждой не прогнанной группе.
- `npm run golden:verify`, `performance_smoke`, полный Linux HA harness —
  предрелизный гейт по процессу, не гейт код-ревью; diff не меняет
  видимый рендер (только busy/disabled-атрибуты) и не трогает backend.
- Ручное подтверждение в реальном браузере (только автоматизированные
  Playwright-смоки и unit-тесты).

## Вердикт

Зелёный. AC1–AC9 закрыты и доказаны воспроизводимо (тесты умеют падать —
проверено лично на 6 новых + 2 переехавших мутантах); дешёвые гейты и
целевая browser-смок-выборка зелёные; находок уровня High/Medium нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/442-marker-write-rollback`, коммит `ffbf8242abf4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4bc5d44a158273057ec9cf1cf34591def23ad7ce`
  ```
  git log --all --format='%H %T' | grep 4bc5d44a1582
  ```
- ТЗ `docs/specs/442-marker-write-rollback.md`, блоб `a9dcca2ff269a1c309387902875a4937efbd4ebf`
  ```
  git log --all --find-object=a9dcca2ff269a1c309387902875a4937efbd4ebf -- docs/specs/442-marker-write-rollback.md
  ```
