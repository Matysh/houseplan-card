# CODE-REVIEW-663-r1

Материал раунда: `59a60d526db73974a81e57b739458f59c18cfe7f` (ветка `issue/663-stairs`,
база `origin/dev`). Диапазон: `git log --oneline origin/dev..HEAD` (18 коммитов,
первый `feat: добавить лестницы между этажами`, далее CI/golden/perf/test
исправления), `git diff origin/dev...HEAD` — 113 файлов, +2858/-167.

Заход: r1 (код-ревью), блокирующих циклов израсходовано 0/4.
Ревью ТЗ прошло зелёным на `SPEC-REVIEW-663-r2` (High-1 r1 закрыт; винтовая
лестница введена в r2 и разобрана полностью).

## Скоуп

Задача из `docs/SCOPE.md`: J1 (физическая связь этажей видна на плане), J4
(GUI-only создание), J6 (геометрия/связи живут вместе с остальным планом).
Реализация: два дискриминированных типа лестниц (`straight`/`spiral`),
отдельный инструмент/группа в Plan-редакторе, continuous-контракт мебели
(move/resize/rotate/Shift-45°), wall-magnet и stair-to-stair magnet, вычитание
footprint из чистой площади, односторонняя ссылка на этаж с safe View-навигацией
(жесты, fixed-floor, битая ссылка), плоский первый этап 2.5D, backend-схема с
лимитом 250/пространство, import/export/repair, i18n на 4 языках, документация.

## Как проверялось

Ссылка на подтверждённый зелёный Validate точного SHA:
https://github.com/Matysh/houseplan-card/actions/runs/36272736672 — job-список
этого прогона проверен построчно (`gh run view … --json jobs`): зелёные —
предпролёт, классификация, **frontend (types+unit+build)**, **мутанты по диффу
(6/6 шардов)**, «доказательство выполненных проверок»; **skipped** — hacs,
hassfest, geometry_parity, backend (pytest), смоки в браузере, golden,
performance_smoke. Это ожидаемо (heavy-гейты не запускаются на обычном пуше
без `Release:`/`full=true`/PR) и означает, что дешёвые гейты подтверждены
конвейером, а тяжёлые — нет; они прогнаны здесь заново.

| Гейт | Прогнано | Результат |
|---|---|---|
| `npx tsc --noEmit` / `npm run build` | зачтено по зелёному Validate (frontend job) | — |
| `npm test` | зачтено по зелёному Validate (frontend job) | — |
| Мутанты по диффу (registry) | зачтено по зелёному Validate (6/6 шардов) + выборочно перепрогнаны лично 2 из 8 stairs-witness через `node scripts/mutation-gate.mjs --id=…` субагентом в изолированном worktree | `stairs-area-does-not-subtract-footprints` и `stairs-view-pan-opens-target-floor` — чистый зелёный/мутант красный, подтверждено |
| `node scripts/check-docs.mjs` | прогнано лично | `Documentation checks passed (7 files, 12 external links)` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнано лично | 101 прямое совпадение, 3 зарегистрированные связи (upload-guard, не относится к лестницам); ожидаемо широкий список — диффа 18 файлов src/**, много общих символов (`_mode`, `_modelCache` и т.д.) |
| `node demo/smoke_stairs.mjs` (AC1/AC3/AC5/AC6/AC7/AC8/AC10) | прогнано лично на свежем `npm run bundle:sync` | `29/29 OK` |
| `node demo/smoke_room_resize.mjs` | прогнано лично (диффа коснулся файл теста) | `OK` |
| `node demo/smoke_summary_first_paint.mjs` | прогнано лично (перф-батчинг площади затрагивает summary) | `OK`, long tasks в пределах прежнего профиля |
| `node demo/benchmark_large_house.mjs` | прогнано лично | `modelReadyMs≈2536`, `longTasks.load.maxMs=2320` — воспроизводит профиль, на который опирается AC13; отдельного зафиксированного порога/baseline-сравнения в репозитории нет (см. «Чего не проверял») |
| `npm run golden:verify` (полная матрица, 179 сцен) | прогнано лично на свежем бандле | **`179 passed`, 0 расхождений** — совпадает с заявлением автора |
| `python -m pytest tests_backend -q` | **не прогнано** | в этой ревью-среде не установлен модуль `pytest` (и `homeassistant`) — окружение не позволяет; логика прочитана и оценена вручную (см. ниже) |
| `npm run invariants -- --config …` | **не прогнано** | нет готового экспорта конфигурации с лестницами под рукой в этой среде; риск закрыт чтением (`test/stairs.test.mjs` — Optimize/area/snap инварианты) и golden/smoke прогонами, которые упражняют ту же геометрию через реальный рендер |

Дополнительно вручную построчно вычитаны и оценены (без прогона, «проверено
чтением, не исполнением», силами пяти параллельных разборов + личным чтением):
`src/stairs.ts`, `src/stairs-editor.ts`, `src/stairs-editor-model.ts`,
`src/stairs-view.ts`, `src/clean-floor.ts`, `src/summary-panel-metrics.ts`,
`src/space-render.ts`, `src/coordinate-canonicalization.ts`,
`src/pdf/pdf-scene.ts`, `src/houseplan-card.ts` (дифф), `custom_components/houseplan/validation.py`,
`import_export.py`, `websocket_api.py`, `coordinate_canonicalization.py`,
`wall_segment_model.py`, `support_package.py`, весь `scripts/mutation-registry.mjs`
(8 stairs-записей), `test/stairs.test.mjs` (184 строки, целиком),
`demo/smoke_stairs.mjs` (346 строк, целиком), тексты docs (`STAIRS.md`,
`CANVAS.md`, `UX-MODES.md`, `CONFIG-COMPATIBILITY.md`, `TOUCH-SUPPORT.md`,
`ISOMETRIC.md`), i18n (`de/en/fr/ru.json`), трейлеры/changelog всех 18 коммитов.

## Находки

### Medium-1 (в скоупе задачи) — AC3 разметка ступеней неверна для `direction: 'backward'`

`src/stairs.ts:149-152` (`stairRenderGeometry`, straight-ветка):

```ts
const count = Math.max(0, Math.floor(stair.length / treadN));
for (let index = 1; index <= count; index++) {
  const x = -stair.length / 2 + index * treadN;
  ...
}
```

Якорь отсчёта ступеней — всегда локальный `-length/2`, **независимо от**
`stair.direction`. Стрелка же однозначно завязана на направление:
`fromX = (forward ? -0.3 : 0.3) * length; toX = (forward ? 0.3 : -0.3) * length`
(`stairs.ts:159-160`) — то есть для `backward` «низ» (хвост стрелки, откуда
начинается подъём) физически находится на **положительном** конце оси, а
«верх» (наконечник стрелки) — на **отрицательном**.

ТЗ §6.1: «У прямой лестницы полные линии ступеней идут… через каждые 30 см от
**нижней** границы. Неразложимый остаток короче 30 см остаётся перед
**верхней** границей». Для `forward` это совпадает (нижняя = `-length/2`,
остаток у `+length/2` = верх). Для `backward` код по-прежнему кладёт полные
интервалы от `-length/2` (который для `backward` физически верх) и оставляет
остаток у `+length/2` (который для `backward` физически низ) — остаток
оказывается **у нижней**, а не у верхней границы, ровно наоборот тому, что
требует контракт.

**Воспроизведение:** прямая лестница `length=1.0` (100 см при `cellCm=5`),
`direction: 'backward'`. `treadN=0.3`×… → 3 полных интервала считаются от
`x=-0.5`, неполный (10 см) остаток оказывается у `x=+0.5`. Для `backward`
`+0.5` — это низ (откуда стрелка начинается), не верх. Ни один тест не
проверяет `direction:'backward'` для straight: `test/stairs.test.mjs` берёт
только `direction:'forward'` в фикстуре `straight()` (строка 23) и ни разу не
переопределяет её на `'backward'` для геометрии ступеней (в отличие от spiral,
где `reverse = stairRenderGeometry(spiral({ direction: 'counterclockwise' }), 5)`
на строке 93 такую проверку делает). Не High: это визуальная неточность
разметки (несколько сантиметров смещения остатка на одном из двух вариантов
направления), не ломает transform/magnet/навигацию/площадь/undo — но это
прямое расхождение с зафиксированным в ТЗ AC3-контрактом и полностью
непокрытое тестами расхождение, а не предположение автора, поэтому чинится в
этой же задаче.

### Medium-2 (в скоупе задачи) — защитный AC7 (состояния битой ссылки) без mutation witness

`scripts/mutation-registry.mjs` содержит ровно 8 записей `stairs-*`
(строки 76–171): 
`stairs-continuous-transform-snaps-to-lattice` (AC2/AC9/AC11),
`stairs-area-does-not-subtract-footprints` (AC4),
`stairs-summary-area-clips-all-footprints-in-one-task` (AC13),
`stairs-view-pan-opens-target-floor` (AC6),
`stairs-fixed-floor-still-navigates` (AC8),
`stairs-link-auto-creates-target-object` (AC5),
`stairs-tread-count-depends-on-render-scale` (AC3),
`stairs-backend-allows-251-items` (AC13).

Ни одна не целится в AC7 (missing/self/deleted target, repair-предупреждение,
безопасное поведение при удалении пространства). Тесты (`demo/smoke_stairs.mjs`
`missingTargetIsVisibleAndInert`/`selfTargetIsVisibleAndInert`/
`deletedTargetIsVisibleAndInert`/`brokenTargetHasRepairWarning`,
`tests_backend/test_ha_websocket.py::test_issue_244_space_delete_dependency_and_tombstone_candidate`)
реальны и не тавтологичны сами по себе — но AC7 явно защитный
(гард/отказ/безопасное поведение), а PROCESS.md §2.7 требует для такого AC
строку «чем доказан · чем краснеет» с непустым третьим столбцом. Автор в
хендоффе заявил «7/7 [позже 8/8] реально покраснели», но этот список не
покрывает AC7 — пустой столбец, Medium по правилу, не заявление о полноте.

### Medium-3 (в скоупе задачи) — защитный AC11 (round-trip/совместимость) без mutation witness

Тот же реестр не содержит мутанта на «старый конфиг без `stairs` идентичен
прежнему» и на import/export remap ссылки по id (`_repair_target_space_refs`
для stairs, `custom_components/houseplan/import_export.py:1144-1151`).
`stairs-continuous-transform-snaps-to-lattice` доказывает только «нет
grid-сдвига после save/load/Optimize» — это часть AC11, но не весь AC
(backward-compat старого конфига и remap ссылки при импорте остаются без
witness). AC11 — защитный (инвариант совместимости), пустой третий столбец —
Medium по тому же правилу.

Итого: **High: 0, Medium: 3 (все в скоупе задачи)**. Без High это жёлтый
вердикт: находки чинятся в этой же задаче, повторный раунд ревью по дельте,
отдельный issue не заводится (#202).

## Что проверено и корректно

- **Continuous/мебельный контракт (r1 High-1 фикс)** — подтверждён и кодом, и
  тестом, который ловит именно регресс r1: `test/coordinate-canonicalization.test.mjs:166-179`
  берёт `x=0.5000001` (в пределах `LATTICE_NOISE_STEPS` от узла 0.5) и требует,
  чтобы значение НЕ схлопнулось к 0.5; `src/coordinate-canonicalization.ts`
  обрабатывает stairs через `scalarFields`, не `latticeFields`; идентичная
  проверка на бэкенде — `tests_backend/test_coordinate_canonicalization_pure.py::test_stair_transform_keeps_continuous_wall_face_magnet_position`.
  Optimize (`plan-optimizer.ts`) не содержит ни одного упоминания stairs;
  `test/stairs.test.mjs:166-184` проверяет побитовое сохранение transform
  через Optimize. Мутант `stairs-continuous-transform-snaps-to-lattice`
  существует и корректно нацелен (прочитан, не прогонялся лично).
- **Wall/stair magnet** — физическая грань с учётом толщины, касание по
  внешнему габариту для всех трёх пар (rect-rect/rect-circle/circle-circle),
  вторая лестница не меняется — подтверждено и юнитами
  (`test/stairs.test.mjs:107-119`), и e2e (`wallMagnetUsesPhysicalFace`,
  `stairMagnetTouchesOtherFootprint` в `demo/smoke_stairs.mjs`, лично
  перепрогнано зелёным). Исправление теста `59a60d52` — легитимное усиление
  (старая точка `y=650` не доказывала срабатывание magnet, новая `y=625` с
  фиксированным `cell_cm=5` действительно требует смещения).
- **Одно число — один источник площади.** `geometryAreaMinusStairs`/
  `geometryMinusStairsSteps` в `src/stairs.ts` — единственная точка вычитания;
  room card (`clean-floor.ts`), summary (`summary-panel-metrics.ts`) и PDF
  (`pdf-scene.ts`) — тонкие обёртки над одной и той же функцией `difference()`
  из `polyclip-ts`; площадь клампится к `Math.max(0, …)`
  (`physical-geometry.ts:424-431`). Backend не считает net-площадь отдельно
  (второго источника нет).
- **Батчинг вычитания площади по кадрам (`ea1f19c3`)** — не меняет итоговый
  результат: `geometryMinusStairsSteps` — генератор, публикация в `areaMemo`
  происходит только по `done`; на промежуточных кадрах пользователь видит
  предыдущее стабильное число, не частично вычтенное. Мутация `batchSize`
  (форсированная в `MAX_STAIRS_PER_SPACE`) красит заявленный тест — проверено
  лично одним из разборов, воспроизведено. Отдельно отмечена (не новая,
  не находка #663) уже существующая транзиентная рассинхронизация summary vs
  room card на несколько кадров при изменении конфигурации — паттерн старше
  этой задачи (см. #509), батчинг делает его точки перезапуска только чаще, не
  создаёт новую гонку.
- **Навигация и жестовые guard'ы** — click в View идёт тем же публичным путём,
  что вкладка (`_tabClick`), pan/pinch/long-press/pointercancel гарантированно
  подавляют переход через общий `_suppressClick`/`TouchGestureClickGuard` плюс
  собственный long-press таймер лестницы; в plan/devices/decor режимах
  навигация структурно недостижима (`_mode==='plan'` всегда роутит на
  нередактируемый `StairEditorRuntime`, у которого нет ни одного пути
  навигации). fixed-floor и все три состояния битой ссылки сведены к одному
  пользовательскому понятию (единое предупреждение, единый некликабельный
  курсор) — подтверждено `demo/smoke_stairs.mjs` (лично перепрогнано, 29/29).
- **2D/2.5D** — один и тот же слой рендерится и в обычной, и в iso-проекции
  через общий `<g class=${iso ? 'iso-floor-scene' : nothing}>`; в
  `src/iso-*.ts` нет ни одного упоминания stairs (нет отдельной высоты/камеры/
  теней); переключение проекции не трогает `space.stairs`.
- **Backend-схема и совместимость** — дискриминированная `STAIR_SCHEMA`
  (`validation.py:1536-1585`), лимит `MAX_STAIRS=250` с тестом на 251-й элемент,
  finite/bounds/kind-специфичные размеры, forward-compat неизвестных полей
  (`extra=vol.ALLOW_EXTRA`, тест проверяет побитовое сохранение) — все
  подтверждены нетавтологичными тестами. Repair ссылки при удалении
  пространства обнуляет только `target_space_id` кандидата, не удаляет
  геометрию (`websocket_api.py:1849-1854`,
  `test_issue_244_space_delete_dependency_and_tombstone_candidate`). Полный
  импорт ремапит ссылку по точной id-карте, не подставляет случайный этаж
  (`import_export.py:1144-1151`,
  `test_issue_663_full_import_repairs_stair_floor_target_by_exact_space_map`).
- **i18n** — согласованные ключи `markup.stairs`, `stairs.*`, `history.stair_*`,
  `space.copy_error_stairs_limit` добавлены идентично в `de/en/fr/ru.json`, без
  конкатенации предложений.
- **Документация** — `docs/STAIRS.md` (новый), `CANVAS.md` §9.4/9.5,
  `UX-MODES.md`, `CONFIG-COMPATIBILITY.md`, `TOUCH-SUPPORT.md`, `ISOMETRIC.md`,
  `USER-GUIDE.md/.ru.md`, `CHANGELOG.md/.ru.md` — обновлены синхронно с
  контрактом; `check-docs.mjs` зелёный (7 файлов, 12 внешних ссылок).
  Трейлеры `Issue:`/`User-Visible:` на всех 18 коммитах корректны; feature-
  коммит `d03a68b8` (`User-Visible: yes`) содержит правки обоих changelog в
  этом же коммите.
- **Golden** — полная матрица (179 сцен) прогнана лично на свежесобранном
  бандле этого SHA: **179 passed, 0 расхождений**, совпадает с заявлением
  автора и локальной аттестацией `sha256:86c19da2c3…`/`fee8da26…`.
- Рассмотренный и **отклонённый** как находка кандидат: отсутствие проверки
  self-target на уровне backend-схемы (`validation.py`). Не бага — AC7 прямо
  требует, чтобы self-цель не «падала», а деградировала грациозно
  (`selfTargetIsVisibleAndInert`); если бы схема отклоняла self при записи,
  этот путь AC7 стал бы недостижим через обычный конфиг. Пропуск проверки на
  уровне схемы здесь — осознанное и правильное решение, а не пробел.
- Рассмотренный и **отклонённый** как находка кандидат: комментарий
  `coordinate_canonicalization.py:162` («continuous like furniture») неточен
  по аналогии (furniture в этом файле идёт через `_lattice_fields`, stairs —
  через более строгий `_scalar_fields`, вообще без узлов сетки), но
  практическое поведение stairs от этого не страдает — оно строже, а не слабее
  требуемого. Низкая приоритетность, не блокирует; можно поправить формулировку
  комментария заодно с фиксом Medium-находок.

## Чего не проверял

- **`python -m pytest tests_backend`** — не прогнан: в этой ревью-среде нет
  установленного `pytest`/`homeassistant` (`ModuleNotFoundError`). Логика
  backend (validation/import_export/websocket_api/coordinate_canonicalization)
  разобрана построчно и сверена с тестами, но исполнение сьютов на этом SHA не
  моё, а зафиксированное автором в WSL (`907 passed, 1 skipped`) — заявлению
  доверяю по совокупности прочитанного кода, но не подтверждаю прогоном лично.
- **`stairs-backend-allows-251-items`** — не прогнан лично (требует pytest);
  мутация и assertion прочитаны и выглядят корректно.
- **`npm run invariants -- --config <export>`** — не прогнан за отсутствием
  готового экспорта конфигурации с лестницами под рукой в этой среде; риск
  «геометрия/ссылки разошлись» закрыт непрямо: golden (179/179, включая
  large-house-сцены) и `demo/smoke_stairs.mjs` упражняют реальный рендеринг той
  же геометрии через продакшн-бандл, а `test/stairs.test.mjs` — числовые
  инварианты (не отрицательная площадь, сохранение transform через Optimize).
- **Полная browser-smoke матрица** (278 смоков) — не гонял все 101 «прямое
  совпадение» целиком (слишком широкий список из-за общих символов диффа);
  прогнал целенаправленно `smoke_stairs` (профильный, 29/29), `smoke_room_resize`
  и `smoke_summary_first_paint` (задеты багфиксами `ce26a051`/`ea1f19c3`) — все
  зелёные. Остальные 98 — не находка ревью, названного в AC покрытия достаточно.
- **`performance_smoke`/formal Full Performance порог** — CI-джоб был
  `skipped` на материале (heavy-гейт), собственного зафиксированного
  baseline-числа для сравнения `benchmark_large_house` в репозитории нет; сам
  бенчмарк лично прогнан и не показывает аномалий (`longTasks.load.maxMs=2320`,
  без роста относительно профиля, описанного автором), но численного
  baseline-сравнения на этом SHA я не проводил.
- **HACS/hassfest/geometry_parity** CI-джобы — skipped на материале (не по
  диффу класса A/manifest, тяжёлый гейт), не прогонял отдельно: дифф не
  трогает `manifest.json`/`hacs.json`/HA-паттерны, риск низкий, не в фокусе
  диффа лестниц.
- Визуальная приёмка AC12 (light/dark, оба типа, оба направления, малые/
  большие габариты) сверена только через golden verify (совпадение с
  принятыми baseline), не через самостоятельный визуальный осмотр PNG-diff.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/663-stairs`, коммит `59a60d526db7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `27c4c97e8737b1fb9b998166de13a98b609ddffe`
  ```
  git log --all --format='%H %T' | grep 27c4c97e8737
  ```
- Тело issue: `f3f0ee8408eb76ccec4f3ec50a9048ff1e29b2967259f0d4c4d333d8c68157e4`
- Вердикт конвейера: `yellow` · High 0
