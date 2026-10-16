# CODE-REVIEW-861-r1

Issue: #861 · трек `ask` · этап `code` (PROCESS.md §2.7) · заход r1 · блокирующих циклов использовано 0/4
Материал: `3485032d88b389378636e48f99025d115cc72b95` (`origin/dev` на момент диффа — `cce7c5edcccde55daca6a3133862d88412768633`); рабочая копия уже на этом SHA, `git fetch/pull/checkout` не выполнялись.

## Скоуп

ТЗ (редакция 3, принято зелёным SPEC-REVIEW-861-r2): этап Э1 общей декомпозиции #861 —
вынос двух самых узких жестов редактора в собственные модули с узким purpose-port
(≤16 членов, без приведения хоста целиком и без `HouseplanEditorHostPort`):

- **владелец 1** — тело перегородки/колонны (перенос, поворот квадратной колонны,
  перебор наложенных тел, двойное нажатие) → `src/physical-body-gesture.ts`,
  `PhysicalBodyGestureRuntime`;
- **владелец 2** — рамка подложки (перенос, масштаб, поворот, сброс, бейдж, отрисовка)
  → `src/backdrop-frame-gesture.ts`, `BackdropFrameGestureRuntime`.

Единственное разрешённое видимое изменение — **AC11**: двери/окна, привязанные к
переносимой перегородке (`host.kind=partition`, `exact id`), следуют за ней уже в
удерживаемом preview, а не только после отпускания. Решение владельца «1б»
(issue-комментарии 6182295739 → 6184696278). Всё остальное поведение — без изменений
(рендер-маршрут 1/0/1, пороги, история, сохранение, i18n, бюджеты/потолки не трогаются).

Это задача класса A (`src/**`), код-ревью полное.

## Как проверялось

Прочитаны целиком: тело issue #861 (редакция 3 ТЗ, включая AC1–AC11, контракт
поведения п.1–9, риски), оба SPEC-REVIEW (r1 зелёный, r2 зелёный) и вся цепочка
комментариев реализации (14 записей batch-сессии 15.10, включая вопрос владельцу о
held-preview и ответ «1б»). Прочитаны полностью оба новых owner-модуля
(`physical-body-gesture.ts` 270 строк, `backdrop-frame-gesture.ts` 191 строка) и оба их
unit-теста (390 + 114 строк). Прочитан новый native-смок AC11
(`demo/smoke_partition_openings_preview.mjs`, 307 строк) целиком. Построчно сверен
`git diff origin/dev...HEAD` для: `src/live-editor.ts`, релевантных кусков
`src/houseplan-card.ts` и `src/houseplan-editor-runtime.ts` (порт, конструктор владельцев,
удаление старых полей/делегатов, маршрутизация pointer-событий), `src/live-interaction-runtime.ts`,
`src/version-recovery-card.ts`, `test/editor-runtime-loader.test.mjs` (новый AST-гейт),
`test/geometry-history-refusal.test.mjs`, `test/live-editor.test.mjs`,
`test/version-recovery-card.test.mjs`, `test/wall-union-isolation.test.mjs`,
`test/candidate-858.test.mjs`, `demo/smoke_free_walls.mjs`, `demo/smoke_backdrop.mjs` (диффы),
`docs/ARCHITECTURE.md`, `docs/WARM-REMOUNT.md`, `docs/DECOR-EDITOR.md`, `docs/CANVAS.md`,
`docs/USER-GUIDE.ru.md`, `scripts/smoke-links.mjs`, `scripts/mutation-registry.mjs`,
`scripts/candidate-native.mjs`, `scripts/candidate-readiness.mjs`,
`docs/release-ledger/v1.80.1/861.json`, `docs/CHANGELOG.md`/`.ru.md`, все 7 коммитов и их
трейлеры. Независимый агент (general-purpose) параллельно перепроверил по диффу и
**исполнением** `test/editor-runtime-loader.test.mjs` структурные AC6–AC10 (см. «Что
проверено» ниже) — его результат совпал с моим.

Численно проверены оба purpose-порта скриптом на TS AST: `PhysicalBodyGesturePort` — 13
членов, `BackdropFrameGesturePort` — 14 (оба ≤16, совпадает с заявленным в ТЗ и хендоффе).

## Находки

Нет. High: 0, Medium: 0.

Риск-флаг этого захода («touch: `backdrop-frame-gesture.ts:92/101/105/108/176` и ещё 44
токена `PointerEvent`/`pointerdown`/`setPointerCapture`») разобран целиком: все
перечисленные и смежные touch/pointer-точки лежат в `PhysicalBodyGestureRuntime` (begin/
move/end, rotateBegin/rotateMove/rotateEnd — AC1), `BackdropFrameGestureRuntime` (begin/
moveNow/end, обработчики ручек в `renderFrame` — AC2/AC5), в маршрутизации
`_stagePointerMove`/`_stagePointerUp` карточки (прежняя маршрутизация по `pid`, AC6) и в
конструкторе владельцев в `houseplan-editor-runtime.ts`. Для каждого класса нашёлся
покрывающий AC: пороги/жесты — unit-тесты владельцев (AC1/AC2) и
`smoke_physical_body_characterization`/`smoke_backdrop` (AC3/AC4/AC5); маршрутизация и
Undo/Esc/pointercancel — `test/geometry-history-refusal.test.mjs` новые кейсы на
настоящем `HouseplanEditorRuntime` (AC6); отсутствие утечки старых имён — AST-гейт в
`test/editor-runtime-loader.test.mjs` (AC7); touch-ветка AC11 — доверенный CDP
`touchCancel` в `smoke_partition_openings_preview.mjs`. Непокрытых touch-классов не
нашёл.

## Что проверено и корректно

- **AC1/AC2 (владельцы, порты).** Оба модуля не импортируют карточку/рантайм как
  значения (только типы), не приводят хост к `any`/`HouseplanEditorHostPort`, порты 13/14
  членов. Старое состояние (`_physicalDrag`, `_physicalRotate`, `_physicalLastTap`,
  `_physicalPickCycle`, `_bdDrag` и их геттеры/реактивные объявления) полностью удалено из
  `houseplan-card.ts` и из `HouseplanEditorHostPort`; делегаты-пересылки
  (`_physicalMove`, `_physicalUp`, `_cancelPhysicalGesture`, `_physicalRotateMove`,
  `_physicalRotateUp`, `_bdMove`, `_bdReset`, `_bdUp`, `_renderBackdropFrame`) удалены, а
  не превращены в однострочные прокси — проверено чтением и подтверждено
  AST-тестом/grep: ни одного вхождения удалённых имён нигде в `src/**`.
  Unit-тесты владельцев (`test/physical-body-gesture.test.mjs`,
  `test/backdrop-frame-gesture.test.mjs`) гоняют реальные числовые пороги (5 px, 5°/Shift,
  0.5°, 380–1200 мс, 360 мс, дубль колонны, clamp по `CANVAS_LIMIT`, снап рамки по
  итоговому левому верхнему углу, а не по дельте) — тесты явно проверяют границы (`4.999`
  vs `5`, `380` vs `381`, `1200` vs `1201`), то есть умеют падать на точной мутации
  порога, а не только на грубой поломке.
- **AC3/AC4/AC5 (прежняя семантика и маршрут рендера).** Диффы `demo/smoke_free_walls.mjs`,
  `demo/smoke_partition_openings.mjs` переводят присваивание `c._physicalDrag=…`/
  `c._physicalUp(...)` на настоящий `page.mouse`-жест через `select`-тул — то, что требовал
  AC7, выполнено, а не просто заявлено. `demo/smoke_backdrop.mjs` получил реальные шаги
  маршрута (`backdrop_body_down_one_full_render` / `..._twelve_moves_zero_full_renders` /
  `..._up_one_full_render`, `bdgrabbing`-класс, заморозка `viewBox`/`_baseVb()` при выходе
  рамки за край и «догон» после отпускания, поворот ручкой 5°/Shift) — именно те шаги,
  которых, по находке ТЗ, не хватало раньше. Новый `_gestureBoundary`/`_publishGesture` в
  `houseplan-editor-runtime.ts` — авторский механизм (ТЗ прямо отдаёт выбор механизма
  автору) даёт полный рендер на begin/end и живой на move; эмпирически подтверждён этими
  же смоками и `test/geometry-history-refusal.test.mjs` (новый тест считает RAF/рендеры).
- **AC6 (потребители через владельца).** `live-interaction-runtime.ts` и
  `version-recovery-card.ts` синхронно переведены на
  `_editorRuntime?.physicalGesture?.active` / `backdropGesture?.active` с тем же
  булевым OR в тех же местах цепочки — семантика «занято» не изменилась. Новый тест в
  `test/version-recovery-card.test.mjs` конструирует настоящие
  `PhysicalBodyGestureRuntime`/`BackdropFrameGestureRuntime` (не моки полей) и проверяет
  idle до/во время/после жеста. `test/geometry-history-refusal.test.mjs` добавил три
  группы тестов на реальном `HouseplanEditorRuntime`: публикация begin/move×12/end,
  `LiveRuntime.active()`/`cardInteractionIdleSnapshot` для обоих владельцев, и Undo/Redo
  для move/rotation/backdrop — каждый проверяет «отмена жеста без шага истории и записи».
- **AC7 (харнесс).** `test/editor-runtime-loader.test.mjs` получил AST-гейт (TypeScript
  compiler API, не строковый grep) с явным списком всех удалённых имён (шире, чем в ТЗ —
  включает приватные `_physicalDown`, `_bdApply`, `_bdStart` и т.д.), который обходит
  `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, `src/live-editor.ts`,
  `src/live-interaction-runtime.ts`, `src/version-recovery-card.ts` и все файлы
  `demo/*.mjs`/`test/*.mjs` (через `readdirSync`, то есть новые файлы автоматически
  попадают в проверку) на PropertyAccess/PropertyAssignment/ElementAccess. Независимый
  агент этот тест реально выполнил (`npx tsc -p tsconfig.test.json && … && node --test
  test/editor-runtime-loader.test.mjs`) — 17/17 зелёных, включая три новых `#861`-теста.
  Это специфичный, а не формальный гейт.
- **AC8/AC9 (ядро, связность, бандл).** `git diff` для `test/core-file-budget.test.mjs`,
  `scripts/monolith-baseline.json`, `scripts/monolith-metrics.mjs` и
  `scripts/bundle-budget.mjs` — пусто: потолки/базы не правились, как и требовал
  не-скоуп. Импорт владельцев в `houseplan-card.ts` отсутствует (grep и AST-тест
  согласны); рантайм-значения владельцев живут только в `houseplan-editor-runtime.ts`
  (`import { PhysicalBodyGestureRuntime, … } from './physical-body-gesture'`), то есть в
  ленивом графе редактора, не в стартовом графе View.
- **AC10 (канон, связи, релиз).** `docs/ARCHITECTURE.md` получил оба модуля в дереве и
  абзац «Editor gesture owners (#861)» рядом с «Editor draft ownership (#851)», как
  требовало ТЗ дословно. `docs/WARM-REMOUNT.md` больше не называет `_bdDrag`.
  `docs/DECOR-EDITOR.md`, `docs/CANVAS.md` описывают новый владелец вместо прежних имён
  методов. `scripts/smoke-links.mjs` связывает оба новых модуля и `live-editor.ts` с 11
  смоками, включая оба новых. `scripts/mutation-registry.mjs` получил 11 новых
  определений мутантов с конкретными `find/replace` на реальных строках новых файлов
  (не на абстрактных описаниях) — не исполнялись (запрещено #709), что и требовалось.
  `docs/release-ledger/v1.80.1/861.json`: категория `infra` → `stable-fix`, обоснование
  сверено с `v1.80.1` (тег действительно содержит перенос partition и
  `materializePartitionOpening`, но не рисовал hosted openings при `physicalDrag` —
  проверено чтением diff, не только утверждением автора); summary ru/en присутствуют.
- **AC11 (held-preview, единственное видимое изменение).**
  `_openingsR` в `houseplan-card.ts:7989` — единая точка проекции: добавляет
  `drag.delta` к уже резолвленным координатам только для `drag.kind==='partition'`,
  `drag.moved` и точного `id`, используя существующий `resolvePartitionOpeningCompat` —
  «одна геометрическая модель», как требует п.9 ТЗ, не вторая. Этой же проекцией
  пользуются и отрисовка (`live-editor.ts`: `physicalOpeningIds` + `_renderOpenings(display,
  moving, false)`), и подавление старой копии (`makeMovingOpeningsTransparent`) —
  ровно «общая pure exact-host projection», заявленная в коммите. `interactive=false`
  убирает `op-hit`-прямоугольник с обработчиками — живой preview не перехватывает
  указатель (п.9). Ротация и перенос колонны не включают проёмы (`physicalOpeningIds`
  фильтрует `drag.kind === 'partition'`). `demo/smoke_partition_openings_preview.mjs` —
  настоящий Playwright-тест на реальной сцене с двумя хостами (перегородка,
  которая двигается, и статичная): проверяет ровно одну видимую копию на id, точную
  дельту на двух разных snapped-целях, неизменность чужого проёма и формы/флипов
  обоих, отсутствие записи конфига/истории до отпускания, восстановление по Esc и по
  доверенному CDP `touchCancel` на том же `pointerId`, один шаг Undo и одну запись на
  принятый жест, отсутствие «призрака» при повторном драге. Это именно обычный
  (ordinary) RED→GREEN свидетель по исходному дефекту, не мутационный прогон.
- **Трейлеры и changelog.** Все 7 коммитов несут `Issue: #861`; `User-Visible: yes`
  ровно на `2ada71e8` (сам фикс AC11), остальные 6 — `User-Visible: no` (чистый
  B/характеризация/рефакторинг/документация). Коммит с `User-Visible: yes` в себе же
  правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` — формулировки о «двери/окна следуют
  за перегородкой уже при перетаскивании» совпадают по смыслу между RU/EN и с текстом
  ТЗ/USER-GUIDE.ru.md (который тоже обновлён в этом же диффе, другим B/C-коммитом
  `ce0c3904`). Видимая величина (поведение следования проёма) описана один раз в каждом
  языковом changelog и один раз в USER-GUIDE.ru.md — источник один (AC11), дублирования
  с расхождением не нашёл.
- **Зелёный CI на материале ровно этого SHA.** `gh run view 38691354734` →
  `headSha: 3485032d…`, `conclusion: success`, и в этом прогоне действительно выполнялись
  (не skipped) «Фронтенд: типы/юниты/мутанты/синхрон бандла», все 3 шарда «Смоки в
  браузере», и отдельно «Golden-кадры против принятых эталонов» — зелёный. Поскольку
  правки затрагивают рендер (`live-editor.ts`, `_renderOpenings`), golden — обязательный
  гейт для этой задачи (не только «дешёвый» tsc/test/build); он учтён и зелёный на этом
  самом SHA, не на более старом коммите автора.

## Чего не проверял

- Не перегонял `npx tsc --noEmit` / `npm test` / `npm run build` и не гонял golden/
  browser-смоки заново — взял готовый зелёный прогон на материале ровно `3485032d`
  (run 38691354734, подтверждён `headSha` и `success`), который уже включает и golden, и
  все три шарда browser-смоков, шире чем «дешёвый» набор из подсказки. Повторный прогон
  добавил бы время, не новую информацию.
- Не выполнял мутационные прогоны (`mutation-gate --check` я тоже не гонял руками) —
  это явно запрещено автору и ревьюеру правилом #709, ловит их только ночь; читал
  формулировки новых 11 определений в `scripts/mutation-registry.mjs` на предмет того, что
  они указывают на реальные строки нового кода (это так), но не проверял, что они
  действительно обнаруживаются ночным раннером — вне объёма код-ревью.
- Не проверял строку за строкой весь объём диффа (2399 вставок/790 удалений, 41 файл) —
  сосредоточился на новых owner-модулях и их тестах (AC1/AC2), интеграции в
  `live-editor.ts`/карточку/рантайм (AC5/AC6/AC9), AC11-цепочке и структурных/
  документационных гейтах (AC7/AC8/AC10) как по явному риск-флагу захода, так и по
  месту наибольшего риска регрессии (тихий прокси/маршрут рендера, отмеченные в разделе
  ТЗ «Риски»). Не читал построчно `test/node-history-runtime.test.mjs`,
  `test/houseplan-render-lifecycle.test.mjs`, `demo/smoke_partition_openings.mjs`,
  `demo/smoke_decor.mjs`, `demo/smoke_grid_scale_invariance.mjs`,
  `demo/smoke_hide_layers.mjs`, `demo/smoke_physical_body_characterization.mjs` целиком —
  только их диффы/заголовки; их структура (харнесс-миграция на реальный ввод, те же
  проверяемые имена/значения) совпадает с шаблоном уже прочитанных файлов того же
  коммита, расхождений не увидел.
- Не проверял Home Assistant/Python-гейты (pytest, hassfest, HACS) — они `skipped` в
  CI-прогоне, так как задача не трогает `custom_components/**`; это ожидаемо и
  соответствует классу правок (TS-only).
- Field/GPU/реальное touch-устройство — не проверялось ни автором, ни мной; ТЗ (AC11,
  раздел «Производительность и touch») явно не требует этого и прямо пишет, что headless
  Chromium с доверенным CDP `touchCancel` не заявляется как доказательство паритета
  физического устройства.

## Вердикт

Зелёный. Структурные ограничения Э1 (узкие порты ≤16, отсутствие проксей/делегатов,
сохранённые ключи очереди, ленивый граф, неизменные потолки/бюджеты) выполнены и
подтверждены чтением и исполнением AST-гейта. Единственное разрешённое поведенческое
изменение (AC11) доказано отдельным обычным (не мутационным) нативным RED→GREEN
свидетелем на реальной сцене с двумя хостами, доверенным touch-отменой и точной
сверкой released-геометрии/истории/записи. Трейлеры, changelog и release-ledger
согласованы между собой и с телом ТЗ. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/861-editor-gesture-owners`, коммит `3485032d88b3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `debd250371fd457bc13cec4b4714e830b453ced4`
  ```
  git log --all --format='%H %T' | grep debd250371fd
  ```
- Тело issue: `2ce4b5a910729e56574ab3ead98fd539788514f50f0f083e68792d85ddf75be6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MzYsIm91dHB1dF90b2tlbnMiOjE0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTA2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMzgsIm91dHB1dF90b2tlbnMiOjMzMjY2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIyNjk4NiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjc2NjMyMTQsImNvc3RVc2RFc3RpbWF0ZSI6Mi43MTg3NzcyOTk5OTk5OTk3fV0sInR1cm5zIjo2MSwiZHVyYXRpb25NcyI6MzY1MzE4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi43MjMyODMzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4574 output_tokens=33280 cache_creation_input_tokens=226986 cache_read_input_tokens=7663214 num_turns=61 -->
