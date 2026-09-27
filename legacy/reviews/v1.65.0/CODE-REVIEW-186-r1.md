# CODE-REVIEW-186-r1 — Безопасный остаток стены у торцов партиционного проёма

Issue: [#186](https://github.com/Matysh/houseplan-card/issues/186)
ТЗ: `docs/specs/186-partition-opening-jamb-margin.md` (зелёное ревью,
`docs/reviews/SPEC-REVIEW-186-r2.md`)
Диапазон: `origin/dev..HEAD` — единственный продуктовый коммит
`57ba75b` «fix: keep jamb margin on partition openings»
(`Issue: #186`, `User-Visible: yes`, оба changelog в том же коммите).
Ветка: `issue/186-partition-jamb-margin`.

## Скоуп

Введён физический jamb safety margin (половина фактической толщины
независимой стены) у обоих торцов hosted-проёма (`door`/`window`/`gate`/
`passage`): разделены compat/read (`resolvePartitionOpeningCompat`, margin=0)
и strict/write (`resolvePartitionOpeningStrict`) резолверы, placement и drag
клэмпятся к новой границе, dialog/rebind объясняют отказ локализованным
сообщением, backend `config/set`/`optimize` применяют тот же контракт как
semantic delta validation, а structural schema и full backup/restore остаются
на прежней zero-margin границе, чтобы не терять уже сохранённые near-end
проёмы. Соответствует J4/J6 (`docs/SCOPE.md`) и не расширяет скоуп ТЗ.

## Как проверялось

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green |
| `npm test` | green, 906/906 |
| `npm run build` + сверка трёх копий бандла (`dist`, `custom_components/.../frontend`, `demo/srv/assets`) | green, побайтово идентичны |
| `node demo/smoke_partition_openings.mjs` (назван в AC2/AC3, поверхность прямо тронута) | green, все поля результата `true`, включая 5 новых (`placementClampsToHalfThicknessJamb`, `directDragStopsAtSameJambBoundary`, `dialogShowsJambSpecificGuidance`, `invalidLengthWritesNeitherConfigNorHistory`, `tooShortPartitionHasNoPreviewAndExplainsWhy`) |
| `python -m pytest tests_backend/test_validation.py -q` (только этот файл тронут напрямую) | green, 132/132 (совпадает с хендоффом автора) |
| `python -m pytest tests_backend -q` (полный офлайн-прогон, без `homeassistant`) | green, 165 passed; `test_ha_import_export.py`/`test_ha_websocket.py` молча пропущены `conftest.py` — HA не установлена в среде ревью, это ожидаемо (`AGENTS.md`: канонический прогон — Linux CI) |
| `npm run golden:verify` (полный набор, Linux) | green, все сценарии `passed`, включая `opening-placement-door-thick-wall-dark`, `opening-placement-passage-thick-wall-{dark,light}`, `openings-thick-wall-dark`, `openings-filled-tunnel-dark`, `openings-hidden-view-dark` — прогнан сверх минимума, т.к. diff меняет clamp/placement геометрию, а не только текст |
| `node demo/smoke_opening_measure.mjs` (побочная проверка того же placement-пути) | green (в этой среде извечная pixel-precision особенность из `AGENTS.md` не воспроизвелась) |

### Не проверялось (и почему)

- `tests_backend/test_ha_import_export.py`, `tests_backend/test_ha_websocket.py` —
  новые тесты в этих файлах **не исполнены**: в среде ревью нет `homeassistant`
  и нет `.venv-backend` (он есть только на облачных агентах по `AGENTS.md`).
  Разобраны построчным чтением (см. AC4/AC6 ниже) — «проверено чтением, не
  исполнением».
- Полный browser smoke suite (127 файлов) — не прогонялся; diff не задевает
  весь фронтенд, только `partition-openings`/`opening-placement`/opening
  dialog. Прогнаны целевой smoke плюс побочный `smoke_opening_measure`.
- `performance_smoke` — не прогонялся; AC не называет perf-эффект, а ТЗ §13
  обосновывает `O(1)` без новых проходов геометрии; изменение ограничено
  сравнением чисел на уже существующих объектах.
- Ручного тестирования в UI не было (по процессу его нет в цикле).

## Проверка AC

### AC1 — единая физическая граница

**Доказано автотестом, тест умеет падать.** `test/partition-openings.test.mjs`
(«strict jamb policy follows thickness, scale and host direction») перебирает
`cm ∈ {1,15,100}`, `(cellCm,gridPitch) ∈ {(5,5),(2.5,8)}` и оба направления
хоста, вычисляет `exactT` **независимо** от кода через ту же явную формулу и
проверяет: точная граница — resolved, `exactT - 1e-5` — `does-not-fit-jamb`.
Backend-зеркало — `tests_backend/test_validation.py::test_partition_opening_jamb_margin_exact_boundary_and_epsilon`,
параметризован по тем же `cm`/`cell_cm`, обоим направлениям и всем четырём
типам проёма; исполнен зелёным (132/132 включает эти кейсы). Независимая
проверка чтением: `partitionOpeningJambMargin` (`src/partition-openings.ts:36-40`)
и backend `margin = cm/2/cell_cm/240` (`validation.py:141-143`) — та же формула,
что зафиксирована в ТЗ §4, `240` вынесена в именованную константу
`NORMALIZED_CANVAS_CELLS` с комментарием о синхронизации с `GRID_STEP_N`/`NORM_W`.
Тест на равенство границы **умеет падать** — если margin/эпсилон перепутать
знаком или множителем, `exactT`/`exactT-1e-5` разойдутся с реальным резолвером
(значения жёстко вычислены в тесте, а не взяты из его же вывода).

### AC2 — placement и drag не создают плохую geometry

**Доказано автотестом + smoke, тест умеет падать.**
`resolveOpeningPlacementResult` (`src/opening-placement.ts:258-296`) требует
`renderedLength + 2·physicalHalfWidth <= hostLength` для eligibility и
клэмпит `along` в `[half, length-half]`, где `half = renderedLength/2 + jambMargin`
(строки 320-338) — совпадает с ТЗ §7.2 дословно. `test/opening-placement.test.mjs`
проверяет конкретные числа (`x=25`/`x=75`, `t=0.25`/`t=0.75`,
`labels[i].distance=10`) для partition-хоста и **отдельно** нулевой jamb для
room-wall (`distance=0`) — тест на регрессию §7.2 «room-wall placement
сохраняет прежнюю границу». Смок `demo/smoke_partition_openings.mjs`
подтверждает end-to-end через реальный DOM/pointer events: клик у торца
клэмпится (`placementClampsToHalfThicknessJamb`), drag существующего проёма к
тому же торцу останавливается на той же границе
(`directDragStopsAtSameJambBoundary`), слишком короткая partition не даёт
preview и объясняет причину через toast (`tooShortPartitionHasNoPreviewAndExplainsWhy`).
Прочитан код клика/drag (`src/houseplan-card.ts:11298-11321` и `:11482-11500`)
— оба пути используют один и тот же resolved-кандидат (`jambMargin =
partitionOpeningJambMargin(...)`, `shoulder = half + jamb`), других мест
клэмпа для partition-хоста не найдено.

### AC3 — dialog и rebind объясняют отказ

**Доказано smoke + разбором кода.** `dialogShowsJambSpecificGuidance` и
`invalidLengthWritesNeitherConfigNorHistory` в `smoke_partition_openings.mjs`
воспроизводят реальный сценарий: `_editOpening` → увеличение длины до 600 см
→ banner с RU/EN текстом margin → `_saveOpening()` не меняет ни `space.openings`
(сравнение `JSON.stringify` до/после), ни счётчик записей конфига (`writes`),
ни `_geometryHistory`. Тест умеет падать: до правки banner показывал бы
`opening.host_partition` вместо margin-текста, а `_saveOpening()` записал бы
конфиг — оба факта проверяются прямым сравнением, а не полагаются на
побочный эффект другого поля. Разбор кода (`src/houseplan-card.ts:17641-17694`)
подтверждает, что dialog различает `orphan` (missing host) и `jambInvalid`
(does-not-fit-jamb) отдельными флагами и не путает их тексты; `lengthTouched`
(`:1342`, `:11635-11636`, `:17650-17655`) корректно не опто́м вводит длину
округлённого legacy-значения в strict-проверку при binding-only правке (type/
contact/lock/invert/flip) — независимая проверка по коду совпадает с ТЗ §7.3 и
принятым предположением №2 (§16). Rebind: `orphanRebindReplacesHostWithoutDuplicate`
в том же smoke подтверждает успешный rebind на валидный host (существующий
сценарий #132, не задет регрессией).

### AC4 — legacy compatibility

**Доказано автотестом (frontend) + разбором кода и backend-тестами (не
исполнены).** Frontend: «strict writes reserve half the real wall depth while
compat reads remain visible» (`test/partition-openings.test.mjs`) явно строит
near-end проём (`t=0.224`, внутри jamb) и проверяет, что `resolvePartitionOpening`
(compat, margin=0) всё ещё резолвит его для всех четырёх типов, тогда как
`resolvePartitionOpeningStrict` возвращает `does-not-fit-jamb` — то есть тест
умеет различать «остался видимым» и «отклонён при прямой правке» и упал бы,
если бы кто-то заменил compat-путь на strict в рендере. `_physicalUp` (rigid
translation, `:7472-7480`) и все read-пути (`space-render.ts:214`,
`houseplan-card.ts:7940,7973,11324,11667`) используют `resolvePartitionOpeningCompat`
— построчно проверено, что бывший «голый» вызов `resolvePartitionOpening` с
неявным `jambMargin=0` (сама находка issue) нигде не остался: `grep` по всем
вызовам показывает только `Compat`/`Strict`, внутренний `resolvePartitionOpening`
вызывается лишь изнутри этих двух обёрток.

Backend delta-валидатор (`custom_components/houseplan/validation.py:110-152`)
включает strict-проверку только если `host.id`/`host.t`/`opening.length`/
`partition.cm`/`span` изменились относительно `previous` — **прочитано и
независимо пересчитано**: rigid-перенос (одинаковый `span`, одинаковый `cm`,
одинаковые `host.id/t/length`) не триггерит strict, посторонняя правка (смена
`title`) тоже. `tests_backend/test_validation.py::test_partition_opening_jamb_delta_preserves_legacy_and_checks_direct_geometry`
(исполнен, зелёный) покрывает четыре ветки: unrelated-edit, type-only, rigid
translation — allow; и четыре прямых геометрических изменения (`t`, `length`,
`cm`, `span` через новое `b`) — reject. Тест умеет падать: если `strict`
неверно посчитать как `False` для любой из четырёх мутаций, `pytest.raises`
не сработает.

Full import/restore: **прочитано, не исполнено** —
`custom_components/houseplan/import_export.py:1324-1334` (`prepare_apply`,
`kind == "full"`) не проходит через `build_space_merge`/
`validate_partition_opening_hosts` вообще, только через структурную
`CONFIG_SCHEMA` на выходе (та же неизменная `does-not-fit` проверка,
`validation.py:906-925`, unrelated diff). Значит full restore физически не
может получить `PartitionOpeningJambMarginError` — соответствует decision #4
и §8 ТЗ. Новый тест `test_full_preview_preserves_legacy_near_end_partition_opening`
(`tests_backend/test_ha_import_export.py`, не исполнен: нет HA) параметризован
по `current_kind ∈ {"empty","other"}`, что покрывает decision #4 дословно
(«на пустой и на другой инсталляции»); по чтению кода `create_preview`
(`import_export.py:1141-1181`) не зависит от `current_config` для ветки
`kind != "space"`, так что ожидание «зелёный на обоих current_kind» логически
устойчиво, но сам прогон не подтверждён исполнением — фиксирую как честный
пробел, не блокирующий (см. «чего не проверял»).

### AC5 — overlap и остальные host не меняются

**Проверено чтением, не исполнением, плюс существующий регресс-набор.**
`hostedOpeningIntervalsOverlap` не встречается в диффе (`git diff` пуст по
этой функции в обоих языках); overlap-проверка backend
(`validation.py:920-924`) и структурная fit-проверка (`:917-919`) — те же
строки, что до PR, jamb margin в них не подмешан. Существующие regression-тесты
#132/#157/#193 остаются в `npm test`/`pytest` без изменений и зелёные.

### AC6 — server parity и error code

**Доказано backend/websocket-тестами.** `config/set` и `plan/optimize`
(`websocket_api.py:1258-1263`, `:1373-1378`) оборачивают один и тот же вызов
`validate_partition_opening_hosts` и один except-список с новым
`PartitionOpeningJambMarginError`; `tests_backend/test_ha_websocket.py::test_config_writers_reject_partition_opening_without_jamb_atomically`
параметризован по обоим эндпоинтам и проверяет атомарность (`config/get` и
`layout/get` после отказа возвращают исходные `rev`/данные) — **не исполнен**
в этой среде (нет HA), разобран по коду: оба хендлера действительно вызывают
валидатор до записи (`await`/`store.async_save` после except-блока в обоих
местах, построчно сверено) и `send_error(msg["id"], err.code, str(err))`
формирует `error.code == "invalid_partition_opening_jamb_margin"` и
сообщение, содержащее `space=…; opening=…; margin=…; margin_cm=…`
(`validation.py:59-68`) — совпадает с тестовыми ассертами дословно. Structural
schema (`SPACE_SCHEMA`, unchanged `does-not-fit`) не участвует в этой цепочке
и не может «сломать» round-trip неизменённого конфига — совпадает с §8.

## Что проверено и корректно (сверх AC)

- **Формула единиц исполнена согласованно.** `wallCmToUnits(cm, cellCm,
  gridPitch) = clampWallCm(cm)/cellCm*gridPitch` — линейна по `gridPitch`,
  поэтому обратное преобразование `(margin/gridPitch)*cellCm` в
  `houseplan-card.ts:12816-12819` алгебраически сводится ровно к `cm/2`;
  проверено пересчётом руками, не только чтением.
- **Единственное расхождение в способе получения `distance` для диалогового
  banner** (`src/houseplan-card.ts:17669-17671`, `jambDistance =
  formatLength(hostPartition.cm / 2, …)` — напрямую через `cm`, а не через
  `partitionOpeningJambMargin` + обратная конвертация, как везде в других
  местах) **не является дефектом**: математически идентично при валидном
  `partition.cm`; расхождение возможно только если `partition.cm` вне
  `[WALL_MIN_CM, WALL_MAX_CM]` до `clampWallCm`, а ТЗ §16.4 прямо говорит, что
  malformed `cm` вне scope #186 и сохраняет действующий schema/fail-dark
  contract — сохранённый `partition.cm` уже проходит schema. Отмечаю как
  **Low, снята без правки**: чисто стилистическая дупликация формулы, не
  влияет ни на один AC и не воспроизводима в валидном состоянии данных.
- **Wall-thickness edit partition.cm вне opening dialog** (`_physicalDialog`,
  `houseplan-card.ts:7257-7259`) не проходит через
  `partitionOpeningNeedsStrictValidation` на фронтенде — и не должно: ТЗ §7.4
  прямо поручает этот случай backend-strict-границе («Изменение длины host или
  его `cm`… должно пройти strict backend boundary»), и backend-валидатор
  действительно триггерит `strict` при изменении `partition.cm`/`span`
  (проверено выше, AC4/AC6). Отказ backend будет показан пользователю через
  тот же generic error-mapping (`_mapConfigError`-подобный путь,
  `houseplan-card.ts:12812-12820`), это тот же механизм, что уже работает для
  `invalid_partition_opening_host`/overlap с #132 — не новый риск.
- **i18n** (`opening.partition_jamb_margin`) добавлен синхронно en/ru и
  дословно совпадает с формулировкой ТЗ §7.3.
- **Документация**: `docs/CHANGELOG.md`/`.ru.md`, `docs/USER-GUIDE.md`/`.ru.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`
  обновлены в том же коммите, терминология («независимая стена», «торец»,
  «откос»/jamb) соответствует `docs/USER-GUIDE.ru.md`, не изобретена заново.
- **Трейлеры и changelog-требование**: единственный продуктовый коммит несёт
  `Issue: #186` и `User-Visible: yes`, оба changelog правлены в нём же —
  соответствует PROCESS.md §2.6/§10.2.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне скоупа. Один Low, снят без правки
(см. выше, «Единственное расхождение…») — чисто стилистический, не
воспроизводится при валидных данных, не влияет ни на один AC.

## Вердикт

Зелёный. Все шесть AC либо доказаны исполненным автотестом с проверенной
способностью упасть, либо разобраны построчным чтением с явной пометкой
«проверено чтением, не исполнением» там, где локальный HA-harness недоступен.
Формула margin идентична на frontend и backend, все исходные call sites из
диагноза issue закрыты явным compat/strict выбором, legacy near-end проёмы
и full backup/restore подтверждённо не регрессируют, golden-набор (полный,
Linux) зелёный без нового baseline.
