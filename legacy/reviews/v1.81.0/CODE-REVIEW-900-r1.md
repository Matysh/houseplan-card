# CODE-REVIEW-900-r1

Issue: #900 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `fb9cada79e0d59ab01d00cc8a2c2514ec92d432d` (рабочая копия на нём;
`git rev-parse HEAD` сверен). Коммиты на ветке: `7829978c` (fix, `User-Visible:
yes`, оба changelog в этом же коммите) и `fb9cada7` (test, `User-Visible: no`).
Merge-base с `origin/dev` — `cef40de2` (после #904).

## Скоуп

ТЗ (зелёный SPEC-REVIEW-900-r1, см. комментарий `#6189791502`) требует:
владение жестами для диалога толщины стены и окна выбора LED (панорамирование,
щипок, колёсико, клик), перемещение диалога толщины за фон/подпись/единицу с
ограничением в границах сцены, фиксированное экранное положение при
панорамировании/зуме, регрессионную защиту уже владеющих поверхностей (лотки,
сводка, модальные диалоги), best-effort touch/pen. Критерии AC1–AC9 — в теле
issue, раздел «Критерии приёмки».

## Как проверялось

**Дешёвые гейты.** Validate на `fb9cada7` зелёный (ссылка в задаче) — `tsc
--noEmit`, `npm test`, `npm run build` не перегонял. Для подготовки демо-стенда
сам прогнал `npm run bundle:sync` (build/rollup прошли чисто) и
`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` — оба без
ошибок; после смоков вернул дерево командой `npm run bundle:clean`
(`git status` после — чисто).

**Смоки по диффу.** `node scripts/smoke-select.mjs --base origin/dev` вернул
43 прямых совпадения + 6 зарегистрированных связей = 49, что совпадает с
авторской цифрой «diff выбрал 49». Сам прогнал (результаты, не заявление
автора):

| Смок | Результат |
|---|---|
| `demo/smoke_canvas_surface_gestures.mjs` (новый, AC1–AC9) | OK, 58/58 проверок (список сверен `HP_SMOKE_CHECKS=1`, совпадает с числом из хендоффа) |
| `demo/smoke_editor_gestures.mjs` (изменён — `composedPath` в фикстурах) | OK |
| `demo/smoke_pan_any_zoom.mjs` (изменён — то же) | OK |
| `demo/smoke_wall_thickness.mjs` | OK |
| `demo/smoke_wallthick_standalone.mjs` | OK |
| `demo/smoke_wallthick_hover_width.mjs` | OK |
| `demo/smoke_editor_styles_lazy.mjs` (#805, лениво-листовой класс) | OK |
| `demo/smoke_led_strip_draw.mjs` | OK |
| `demo/smoke_room_gear_drag.mjs` (общий порог `ROOM_GEAR_DRAG_THRESHOLD_PX`) | OK |

Остальные 40 позиций выборки не прогонял: они совпали по словам-маркерам
(`_pointers`, `_wallDialog`, `stopPropagation`, `nodeMove`, `roomGear` и т. д.)
без прямого отношения к изменённым строкам (например, `smoke_cover_tap`,
`smoke_tap_run`, `smoke_radar_setup`). Это сокращение, а не нулевой прогон:
девять прогнанных смоков покрывают каждый изменённый файл (`houseplan-card.ts`,
`houseplan-editor-runtime.ts`, `led-strip-editor.ts`, `editor-dialogs.styles.ts`,
новые модули) и три соседних инварианта (лоток, #805, общий порог
перетаскивания). `smoke_draw_wall_thickness`, `smoke_summary_panel`,
`smoke_kiosk_pan_lock` (AC9, не в прямой выборке) не прогонял — решение
ограничить объём сознательно, риск низкий: они проверяют уже владеющие
поверхности, которые этот дифф не трогает (только читает их как образец в
`SURFACE_OWNER`/документации).

**Unit.** `node --test test/canvas-surface-gestures.test.mjs
test/candidate-858.test.mjs` — 15/15 зелёных. Предикат и функция ограничения
(AC9а, AC3) — чистые функции, тест умеет падать: сам убедился чтением (без
выполнения мутации — см. ниже), что переворот `!path.some(...)` или снятие
`inset`-ограничения ломает соответствующие ассерты из `test/canvas-surface-
gestures.test.mjs:10,13,17-21`.

**Реестр мутантов.** `node scripts/mutation-gate.mjs --check` — PASS,
1600 определений, 0 ошибок формата, предупреждение про превышение ориентира
372/200 ожидаемо (растёт на 5 новых браузерных guard, см. `docs/testing-
notes/mutation-browser-guards.md`). Мутанты **не применял** и не исполнял —
по `docs/process/REVIEWER.md` «Трек show» и общему правилу: мутанты в
разработке не гоняет и ревьюер тоже, проверка — что защита названа мутантом в
реестре с объяснением «chem krasneet». Для каждого защитного AC это есть:

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 | smoke (исполнение, проверил) | `surface-stage-pointer-guard-removed` |
| AC2 | smoke | `wall-dialog-handle-includes-input-and-buttons` (кнопка/перетаскивание) |
| AC3 | unit + smoke | `surface-position-not-clamped` |
| AC4 | smoke | `wall-dialog-back-inside-camera-layer` |
| AC5 | smoke | `wall-dialog-wheel-changes-number` |
| AC6 | smoke | `wall-dialog-handle-includes-input-and-buttons` |
| AC7 | smoke | `surface-scene-path-always-owned` (через `hp-dialog` в `SURFACE_OWNER`) |
| AC8 | smoke | `surface-contact-enters-view-pinch` |
| AC9 | unit + smoke | `surface-scene-path-always-owned`, `surface-stage-pointer-guard-removed` |

Ни одна защитная строка таблицы «AC/мутант» не пустая — требование §2.7
выполнено.

**Не проверял и почему:**
- `ci:golden` — не запускал: ТЗ явно говорит «диалог не входит в golden-сцены»,
  диффу не нужен сигнал `render`, метки `ci:golden` на задаче нет.
- `pytest tests_backend` — нет правок Python, не запускал.
- `npm run invariants` — геометрическая модель (`wall-thickness.ts` и соседние)
  не изменена, только маршрутизация жестов и позиционирование DOM; не запускал.
- Полный `node --test test/*.test.mjs` и полная smoke-матрица — Validate уже
  подтвердил `npm test`; полный набор остаётся предрелизным гейтом (§8), не
  гейтом этого ревью.
- Реальное железо: физический тач/перо, настоящий HA `ha-dialog` — автор прямо
  пометил как непроверенное в ТЗ и хендоффах; вне возможностей CI-ревью.
- Мутации не исполнял (см. выше) — это соответствует правилу, не пробел.

## Находки

Высоких и средних находок нет.

Низкая, снимаю сам без действия автора: в последних комментариях хендоффа
(14:20–14:36) автор называет HEAD `6b8b9ccb580ec47a90bb0943d447acccae318d62`
(база `1b95f78154a39b6838202234d3c017e1f2c2fb16`, слиты #901/#903/#908) —
этот SHA не резолвится в репозитории (`git cat-file -t` → fatal). Материал
ревью — два аккуратных коммита `7829978c`/`fb9cada7` от 17:02–17:13, на базе
`cef40de2` (после #904), чьё содержимое (файлы, модули, доказательства AC,
ledger) практически дословно совпадает с тем, что хендофф описывает для
названного недостижимого SHA. Объяснение, согласующееся со всеми фактами:
трек `ask` прямо разрешает ребейз перед ревью (`AGENTS.md` «Review pipeline
prices…», §10.4), и такой ребейз перед выставлением `S7-code-review` без
отдельного комментария — ожидаемое поведение, не нарушение. Я не нашёл
расхождений между описанным в хендоффе содержимым и фактическим диффом —
независимая проверка кода и тестов (выше) подтверждает заявленное. Это не
находка, которая блокирует вердикт; указываю для прозрачности и на случай,
если в будущем раунде тот же разрыв не объяснится так же чисто.

## Что проверено и корректно

- Диалог толщины вынесен из `data-hp-live-layer="camera"` в `.zoomwrap`→`…`
  наружу, но внутри `.stage` (`houseplan-card.ts:11248-11251`) — подтверждено
  чтением структуры шаблона и смоком AC4 (экранное положение не плывёт при
  pan/zoom/кнопках масштаба, ни в середине жеста, ни после).
- `sceneGestureFromPath`/`SURFACE_OWNER` (`canvas-surface-gestures.ts`) —
  единый предикат, применён во всех перечисленных в ТЗ обработчиках:
  `_onWheel`, `_stagePointerDown`, `_stagePointerMove` (с корректным
  исключением уже захваченных `_pointers`, чтобы начатая сцена-панорама не
  обрывалась, если указатель пролетает над поверхностью), `_markupClick`,
  карта touch-контактов (`inStage`). Код сверен построчно с диффом
  `houseplan-card.ts`.
- `WallThicknessDialogGesture` — чистый DOM-владелец: порог 3 CSS px
  (переиспользует `ROOM_GEAR_DRAG_THRESHOLD_PX`, один источник, не
  задублирован), `setPointerCapture`/`releasePointerCapture` с защитой от
  двойного `finish()`, `ResizeObserver` на себя и на `.stage`, `dispose()`
  убирает все слушатели/RAF/observer. `ref`-биндинг пересоздаётся через
  `keyed(d.a, …)`: `d.a` — новый массив при каждом открытии диалога (у
  `wallIntervals`/`offer` в `wall-thickness.ts:2515` не переиспользуется между
  вызовами), так что новое открытие сбрасывает позицию, а правка поля
  (`{...d, value}`) сохраняет ссылку на `a` и не пересоздаёт узел/жест — это
  соответствует «Время жизни» контракта (AC2/AC3), проверено чтением и
  смоком.
- Клэмп (`clampSurfacePosition`) и его top-left поведение для диалога больше
  сцены проверены unit-тестом на границах, включая пересчёт при изменении
  размера сцены (unit + smoke `AC3 stage resize re-clamps`).
- `led-strip-editor.ts` — `hp-dialog` окна LED гасит `pointerdown/move/up/
  cancel/click/dblclick` в дополнение к уже бывшему `wheel`; дополнительно сама
  попадает под `SURFACE_OWNER` по тегу `hp-dialog`, так что защита двухслойная
  (разумный запас, не вред).
- `z-index: 80` диалога толщины — выше лотка (70) и ниже тоста (120); обычные
  модальные диалоги используют нативный `<dialog>`/HA-шелл, который рисуется в
  top layer браузера независимо от z-index стекового контекста карточки —
  порядок слоёв из контракта UX выполняется.
- Бюджет бандла: `scripts/monolith-baseline.json` поднят ровно до
  владельцем одобренного потолка `2931171` (решение владельца —
  `issuecomment-6193307612`), полоса 2000 не менялась, остальные метрики
  (`delegates`, `portMembers`, `hostRefs`, `portPrivates`, `harnessPrivates`)
  не выросли. `dist/**` не менялся (класс D, нет `Release:` трейлера —
  ожидаемо для обычной задачи).
- Трейлеры: `Issue: #900` на обоих коммитах; `User-Visible: yes` у `7829978c`
  с правками `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же коммите;
  `User-Visible: no` у `fb9cada7` (только тестовые фикстуры и дополнение
  авторского документа находок) — трейлеры согласованы с содержимым.
  Changelog — одна формулировка смысла в обоих файлах, один источник правды
  (номер issue, не дублирующееся число).
- Release ledger `docs/release-ledger/v1.80.1/900.json`: `stable-fix`,
  обоснование предметно связывает фактическую реализацию с дефектом,
  существовавшим в `v1.80.1` (проба автора на собранном `v1.80.1` в теле
  issue подтверждает это независимо от ledger); двуязычная `summary`
  заполнена; заменяет корректно более раннюю doc-only `infra` запись (#903).
- i18n не тронут — соответствует ТЗ («Новых ключей нет»); `test/i18n*`
  не менялись, новых текстов в диффе не нашёл.
- `docs/STATUS.md` содержит буквальную строку `Touch editor: best effort /
  intentionally degraded` — закрывает Low, поднятый на этапе SPEC-REVIEW.
- `scripts/candidate-readiness.mjs`/`candidate-native.mjs`/
  `test/candidate-858.test.mjs` — новый editor-профиль зарегистрирован,
  `NATIVE_PROFILES.editor.length` и список файлов, требующих профиль,
  обновлены согласованно; проверено чтением и прогоном unit-теста.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 →
в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/900-dialog-gesture-ownership`, коммит `fb9cada79e0d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2926f01e2bf1c14724986329d327d9eb3154bef6`
  ```
  git log --all --format='%H %T' | grep 2926f01e2bf1
  ```
- Тело issue: `51ecec0b25eef46050f066ed60f0379c3b461cb136b74440a9034ec370d97cb1`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2OTgsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzgzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDQsIm91dHB1dF90b2tlbnMiOjQ0NjQ4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3NDA4MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjk1NTU3MDksImNvc3RVc2RFc3RpbWF0ZSI6My4wNTQyMzM4MDAwMDAwMDA0fV0sInR1cm5zIjo3NywiZHVyYXRpb25NcyI6NzA2MDg2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4wNTkwMTY4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4842 output_tokens=44665 cache_creation_input_tokens=174081 cache_read_input_tokens=9555709 num_turns=77 -->
