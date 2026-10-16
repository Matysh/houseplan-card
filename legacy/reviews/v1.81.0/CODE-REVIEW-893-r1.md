# CODE-REVIEW-893-r1

Материал: `7a7cf8ccef91717eb112deb8ddec7125ef449f2b` (origin/dev..HEAD =
c2492df2, 300267d8, 70e65318, ebfe06c6, 7611cc68, 7a7cf8cc). Merge-base с
`origin/dev` = `dced034b` = текущий tip `origin/dev` — ветка ровно на вершине
dev, ребейз не требуется. Трек: `ask`. Заход r1, блокирующих циклов 0/4.

## Скоуп

ТЗ (SPEC-REVIEW-893-r1, зелёный) требовало: (1) выровнять eligibility
alignment/equal-spacing guides с реально нарисованным ростером иконок
(исключить hidden/tombstone/HA-disabled/LED-replaced); (2) для Walls —
подсказку реального победившего independent-wall endpoint (#885), без второй
snap-логики; (3) отмену только незавершённого device-drag на
pagehide/hidden/disconnect/смену editor или space, с восстановлением
pre-drag позиции без письма/истории/сервисного вызова, не трогая уже
released/pending write; (4) без UX/i18n/моделей данных; (5) CANVAS.md без
устаревшего `_savePos`.

Все пять строк Core user jobs: J6 (eligibility/lifecycle реальность
редактора) напрямую; изменение полностью внутри admin-only редакторов
Devices/Walls — View не получает новых обработчиков (проверено чтением
`_pointerDown`/`_clickDevice`: `_deviceDrag` заводится только в
`this._mode === 'devices'`, значит `DeviceDragRetirement` в View остаётся
вечно пустым и безвредным).

## Риск по изменённым участкам (#707)

- **geometry** (`src/wall-end-align.ts:18,23-26` и ещё 9 строк — вся функция
  `alignWallEnd`/`alignDrawnWallEnd`): покрыт AC2 ТЗ дословно («Walls guides
  показывают опору независимого structural endpoint… без ложного обещания при
  endpoint/axis/closure/Shift»). Новый параметр `onMatch`/`onGuide` —
  чисто наблюдательный колбэк, не меняющий возвращаемое значение функции
  (подтверждено тестом: `alignDrawnWallEnd` даёт тот же `[417.3, 5]`, что и до
  правки, при этом дополнительно сообщает guide).
- **touch** (`src/houseplan-card.ts:5662`, токен `PointerEvent`): покрыт AC3
  («Late move/up/click retired capture не совершает действие»). Новая строка
  — `this._deviceDragRetirement.blocksClick(ev as PointerEvent)` — тот же
  установленный в проекте паттерн «задержанный compatibility-клик не должен
  сработать» (см. `docs/TOUCH-SUPPORT.md` строка 61, уже существующий для
  kiosk-hold). Для View этот путь неактивен (см. выше), новый интерактивный
  слой в View не появляется.

Оба класса покрыты AC ТЗ — reclassify не требуется, `route: fix`.

## Как проверялось

Зелёный Validate на этом точном SHA подтверждён:
[ordinary run 38675789524](https://github.com/Matysh/houseplan-card/actions/runs/38675789524),
[full run 38675820178](https://github.com/Matysh/houseplan-card/actions/runs/38675820178)
— сверено `gh run view 38675820178 --json jobs`: `headSha` = материал,
`conclusion: success`, джобы включают «Golden-кадры против принятых эталонов»,
все 3 шарда «Смоки в браузере», «Перф-смок: бюджет времени кадра», «Геометрия:
TS/Python parity» — все `success`; `pytest`/Hassfest корректно `skipped` (нет
правки Python). Это закрывает typecheck/test/build/bundle-policy/golden/perf —
повторно не гонял.

Сверх Validate (гейты, которые он не закрывает, выбраны по диффу и риску):

| Гейт | Команда | Результат |
|---|---|---|
| Структурная проверка мутантов (новые/изменённые защиты AC1–AC3) | `node scripts/mutation-gate.mjs --check` | PASS, все 11 новых/изменённых id — `ok`, static readiness 1546/346, 5 унаследованных warning (не новые) |
| Unit-свидетели новых модулей | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/device-icon-roster.test.mjs test/device-drag-retirement.test.mjs test/wall-end-align.test.mjs test/live-editor.test.mjs test/device-marker-polish-contract.test.mjs` | 29/29 PASS |
| `no-new-private-writes` | `node scripts/no-new-private-writes.mjs --base origin/dev` | PASS, 484 добавленных строк только в `demo/smoke_*`/helpers, новых записей в приватное состояние нет |
| `smoke-select` (AC + диапазон) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 42 прямых совпадения + 1 зарегистрированная связь (`smoke_wall_guide_ownership.mjs` ← `src/wall-end-align.ts`), НЕОПРЕДЕЛЁННОСТЬ не возникла |
| Нативные смоки — прямое совпадение/AC-поименованные | `node demo/smoke_editor_guides_lifecycle.mjs`, `smoke_wall_guide_ownership.mjs`, `smoke_align_guides.mjs`, `smoke_device_equal_spacing.mjs`, `smoke_device_position_history.mjs`, `smoke_drag_bounds.mjs`, `smoke_wall_end_align.mjs`, `smoke_modes.mjs` | 8/8 PASS (после `npm run bundle:sync`) |
| **Отрицательная проба вручную** (помимо структурной проверки реестра) | временно применил патч `retired-device-tail-opens-settings` к `src/houseplan-card.ts` (строка 5662), пересобрал, перегнал `smoke_editor_guides_lifecycle.mjs` | **RED**: `AssertionError … editor: native unfinished drag is really owned`, сценарий ломается каскадно — старый retired-клик открывает настройки и путает следующий этап сценария. Источник восстановлен в исходное состояние (`diff` с `git show HEAD:…` пуст), бандл пересобран обратно и возвращён `npm run bundle:clean` (git status чист) |
| Инварианты модели (`invariants`) | не гонял | Изменение в `wall-end-align.ts` — чисто наблюдательный колбэк поверх уже существующей (#885) функции сопоставления; возвращаемая точка снапа не меняется (доказано тестом и неизменными #885 AC1–AC7, все 9/9 PASS в этом же прогоне). Персистентная геометрическая модель (room/wall union, invariants) не затронута — гонять `npm run invariants` нечего проверять в этом диффе |
| `golden:verify`/полные наборы/`pytest` | не гонял | Полный золотой прогон и perf уже зелёные на этом SHA в Validate (см. выше); Python не менялся |

## Находки

Нет High. Нет Medium.

## Что проверено и корректно

- **AC1** (eligibility): `device-icon-roster.ts` — чистые `visibleIconMarkers`/
  `positionableIconMarkers`; `_alignCandidates`/`_deviceSpacing`
  (`houseplan-editor-runtime.ts:10498-10522`) и painted-list в
  `houseplan-card.ts:10847` переведены с `_devices`/ручного фильтра на
  `_renderDevices` + общий helper. Unit (`device-icon-roster.test.mjs`) и
  нативный смок (`smoke_editor_guides_lifecycle.mjs`, roster actual==expected,
  hidden/disabled/removed/LED/other-floor все отсутствуют) подтверждают.
  `marker.removed` ранее не проверялся в painted-list при `showGhosts` —
  реальный, зафиксированный тестом фикс (tombstone больше не рисуется
  ghost-иконкой).
- **AC2** (Walls guide): `alignWallEnd`/`alignDrawnWallEnd` сообщают
  фактическую выигравшую точку через колбэк, без второго прохода снапа;
  `_resolvePlanDrawPoint`/`_renderAlignGuides` блокируют guide при
  node/axis/closure/ambiguous/45°-Shift кандидате (`wallGuideBlocked`).
  Существующие #885 AC1–AC7 тесты (9/9) не тронуты и зелены; новый тест и
  `smoke_wall_guide_ownership.mjs` (8 сценариев H/V×0/20см×zoom×theme,
  endpoint/axis/closure negative owners) зелены.
- **AC3** (lifecycle retirement): `_cancelDeviceDrag` вызывается из уже
  существующего общего `pagehide`/`visibilitychange` слушателя
  (`visual-continuity.ts` — один слушатель на документ, не дублируется), из
  `_commitSpace` (смена floor) и из `disconnectedCallback` (последний не
  менялся в этом диффе). `_deviceDrag = null` синхронно выставляется до
  начала async `_persistDevicePlacement` в `_pointerUp` — поэтому
  released/pending-write не откатывается отменой (подтверждено чтением,
  неизменным кодом, и нативным контролем в смоке:
  `retiredPointer.lateDeliveryTrusted:false` после accept). `DeviceDragRetirement`
  — новый, маленький, покрытый 9 assert-ами unit-тест плюс отдельный
  зарегистрированный мутант на каждую ветку (`begin`/`retire`/`key`).
  Детач-DOM-откат (`commitHouseplanEditor` + `paintDevice`) проверен двумя
  новыми unit-тестами (подключена/отключена карточка) и вручную
  подтверждённой RED-пробой выше.
- **AC5** (CANVAS.md): таблица устройства маркеров обновлена на
  `_devicePlacementForCanvas`→`_persistDevicePlacement` (строка проверена —
  оба метода существуют с этими именами); добавлен абзац про shared eligibility
  и lifecycle-retirement, без выдуманных имён.
- Трейлеры: все 6 коммитов несут `Issue: #893`; оба `User-Visible: yes`
  коммита (c2492df2, 300267d8) редактируют `docs/CHANGELOG.md` **и**
  `docs/CHANGELOG.ru.md` в том же коммите.
- Changelog/USER-GUIDE формулировки на русском совпадают с принятой
  терминологией («значки», «направляющие», «перетаскивание», «этаж»), новых
  слов интерфейса нет — консистентно с «без новых настроек» в ТЗ.
- `docs/release-ledger/v1.80.1/893.json`: `stable-fix` относительно
  v1.80.1 с явным обоснованием смешанной задачи (единая категория для
  eligibility/lifecycle, Walls-guide явно не выдаётся за отдельную stable
  фичу — #885 подтверждённо принадлежит текущему бета-циклу, не v1.80.1:
  проверено `git log --oneline --all | grep 885`, коммиты #885 отсутствуют в
  истории до текущей беты). Одно число — "один guide layer" — один источник
  (`this._wallEndGuide`), второй SVG-слой не создаётся (проверено чтением
  `_renderAlignGuides`).
- История координации (#847 dependency) закрыта корректно: `git merge-base
  HEAD origin/dev` == `origin/dev` HEAD == `dced034b`, и #847 коммиты
  (`edd0216f`, `bfaa698c`, `3e10b8ad`) уже являются предками этой базы —
  финальный материал не заимствует непринятый код, ветка ровно на вершине dev.
- `scripts/mutation-registry.mjs`: 9 новых id + 2 изменённых (`spacing-*`,
  из-за перехода `device-spacing.ts` на общий roster) — все структурно `ok`
  при `--check`, таблица «AC · чем доказан · чем краснеет» из тела issue
  заполнена названными id без пустого столбца.

## Чего не проверял

- `npm run invariants` — обоснование в таблице гейтов выше (диапазон диффа в
  `wall-end-align.ts` не меняет геометрический результат, только добавляет
  readonly-наблюдение; персистентная модель не тронута).
- Полный `golden:capture`/`golden:verify`, полный `npm test`, `npm run build`
  с трёхсторонней сверкой копий бандла, performance-бенчмарки — все уже зелёные
  на этом точном SHA в Validate (ссылки выше), повторный прогон добавил бы
  время без нового сигнала.
- `pytest tests_backend` — не гонял: диапазон не трогает
  `custom_components/houseplan/**`, Python-джоб в Validate корректно
  `skipped`.
- Полная матрица 341 нативного смока — вместо неё прогнал AC-поименованные и
  все 8 кандидатов из прямого совпадения `smoke-select`, затрагивающих
  изменённые символы (`_alignCandidates`, `_deviceDrag`, `_pos`,
  `_renderDevices`, `_cancelDeviceDrag`); «широкие» символы (`_editorRuntime`,
  `_tool`, `_markup`) дали десятки дополнительных совпадений, которые не
  гонял — задача не меняет их собственное поведение, только потребляет через
  уже проверенные выше точки входа.
- Ночной прогон реестра мутантов (execution) — по правилу трека: мутанты не
  исполняются ни на каком треке во время разработки, это обязанность ночи
  (#709); вместо этого вручную применил один мутант (`retired-device-tail-
  opens-settings`) к живому исходнику и подтвердил RED, затем откатил —
  сверх требуемого минимума, как дополнительная уверенность по flagged
  touch-участку.
- Реальные Android/iOS устройства, реальный bfcache/GPU — смоки используют
  CDP-пинч и явно диспатченные `pagehide`/`pageshow`, что сам автор и
  документ `DEVELOPMENT.md` честно называют не полным доказательством
  настоящего browser backgrounding; это ограничение унаследовано от
  существующей инфраструктуры (#847) и не предмет этой задачи.

## Вердикт

Зелёный. Все AC доказаны автотестом или нативным смоком, мутация каждой
защитной ветки AC3 названа в реестре и структурно подтверждена, один мутант
вручную проверен на RED. Геометрический и touch-риски из промпта оба покрыты
соответствующими AC ТЗ. Trailers, changelog, release ledger и канонический
документ (CANVAS.md) в порядке. Branch на вершине dev, зависимость от #847
закрыта корректно.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/893-editor-guides-lifecycle`, коммит `7a7cf8ccef91` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9433641f740b682703ce5efc3320ef112bf078da`
  ```
  git log --all --format='%H %T' | grep 9433641f740b
  ```
- Тело issue: `e67873c221aba2a1ced13357846b196ecc90576f16fcad31813a1ea923ae1f00`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0NTMsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTQzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNjgsIm91dHB1dF90b2tlbnMiOjQ0NDI1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1ODYxMywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEwMzY2MDY2LCJjb3N0VXNkRXN0aW1hdGUiOjMuMTUyMjUxMjAwMDAwMDAxNn1dLCJ0dXJucyI6MTAwLCJkdXJhdGlvbk1zIjo4MzY4NTEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjozLjE1Njc5NDIwMDAwMDAwMTUsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4621 output_tokens=44443 cache_creation_input_tokens=158613 cache_read_input_tokens=10366066 num_turns=100 -->
