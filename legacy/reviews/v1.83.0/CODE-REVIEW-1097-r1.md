# CODE-REVIEW · issue #1097 · заход r1

**Материал:** `31135f084a7868eea027db3de767e4a3339eaddb` (рабочая копия на этом SHA).
**Вердикт:** yellow
**Маршрут:** fix (задан трейлером #726)

## Скоуп

Жест `_opDrag` для проёмов (дверь/окно/проход) на стене комнаты и на перегородке:
вместо полного пересчёта `wallBodiesUnionPath` для всего этажа на каждый
pointermove — локальная перерезка тела-хозяина, тёплый union для остальных
стен, коммит один раз на pointerup. Классы риска по дельте:
geometry (`src/opening-drag-preview.ts` — новый файл, 215 строк, прочитан
целиком) и touch (`src/houseplan-editor-runtime.ts:6265`, токен
`pointercancel` в `_opPointerUp`).

## Как проверялось

Static-first: прочитан REVIEW_CONTEXT (тело issue/ТЗ, хендофф, ciEvidence),
весь диапазон `changedFiles` прочитан по существу (не построчный diff, а
прослеживание вызывающих путей). Независимо, до чтения хендоффа, прослежены:

- `src/opening-drag-preview.ts` (новый): `OpeningDragWalls` держит clip/room/
  target/patches по ключу `viewport+bounds`; `render()` оборачивает
  `prepare()` в try/catch → `null` при любой неожиданности — это и есть канал
  до fallback (контракт п.5).
- `src/houseplan-editor-runtime.ts`: `_opPointerDown/_opPointerMoveNow/_opPointerUp`
  — драфт живёт в `drag.preview`, `drag.source` (запись этажа) не трогается до
  `_opPointerUp`; `_cfgEpoch` увеличивается ровно один раз, на коммите
  (`:6280`), не на кадре. `_renderOpeningDragBodies` (`:6079-6111`): при
  несовпадении `drag.epoch !== _cfgEpoch` либо отсутствии `base/moving` —
  явный канонический fallback с отдельным счётчиком
  `_openingDragFallbackBuilds` (не трогает `_floorCacheBuilds.*` и
  `_wallUnionPool`). `_cancelOpeningDrag` сбрасывает драфт и
  `_openingDragWalls` без записи.
- `src/houseplan-card.ts`: `_wallUnionGeometry()` (`:9199-9226`) и
  `_physicalBodiesR()` (`:9859-9870`) ключуются через `_floorKey`, который
  читает сохранённую запись этажа (`_curSpaceCfg`), а не драфт — поэтому ключ
  не меняется в течение жеста и кэш остаётся тёплым без обращения к пулу.
- `src/floor-geometry-key.ts`: `floorPoolEntry` при чтении из пула или
  построении делает `{ ...value }` — это достаёт non-enumerable
  `rawPatches` из `PhysicalBodyParts` (`Object.defineProperty` в
  `physical-geometry.ts:280`). Риск был реальным: без исправления
  `OpeningDragWalls.prepare()` молча терял `rawPatches` для перегородок после
  первого прохода через пул. Исправлено в `_physicalBodiesR` (`houseplan-card.ts:9868`)
  явным `return { key, ...parts, rawPatches: parts.rawPatches }` — поле
  становится обычным enumerable полем этого конверта и переживает spread.
  Подтверждено и тестом `test/opening-drag.test.mjs:142-149` ("physical
  result retains raw joins...").
- `src/interaction-types.ts`: `OpeningDragState` — чистая форма, драфт/оригинал
  разделены корректно.

Исполнено (адресно, под конкретные пробелы независимой трассировки):

| Check | Результат | Зачем запущен |
|---|---|---|
| `build:build` | PASS | требуется для smoke (bundle) |
| `build:test` | PASS | требуется для unit, импортирующих `test-build` |
| `build:bundle:sync` | PASS | без него смоук падал по таймауту `launch()` |
| `build:typecheck` | PASS | типы `OpeningDragState`/`PhysicalBodyParts` пересекают 6 файлов |
| `unit:test/opening-drag.test.mjs` | PASS | прямая проверка драфт/коммит/epoch/cancel/fallback/clip/rawPatches семантики |
| `smoke:demo/smoke_opening_drag.mjs` | PASS (после bundle:sync) | единственное исполняемое доказательство AC1–AC3/AC5 на реальной карточке (native pointermove×30, touch cancel через CDP, pan/zoom/4 поворота, refusal/rollback, неизменные `_floorCacheBuilds.*`/`_wallUnionPool` за кадр, соседние этажи не остывают) |
| `smoke:demo/smoke_partition_openings_preview.mjs` | PASS | AC4, host.t на перегородке |
| `smoke:demo/smoke_floor_cache_reuse.mjs` | PASS | независимый от задачи риск регрессии кэша этажей (AC6 соседний эффект) |
| `smoke:demo/smoke_opening_measure.mjs` | PASS | исправленный B-свидетель (читает видимый SVG symbol вместо записи во время drag) |
| `unit:test/core-file-budget.test.mjs` | PASS | файл в changedFiles (бюджет размера core-файлов) |
| `static:mutation-registry` | PASS | статический `--check` реестра мутаций |
| `static:bundle-budget` | PASS | бюджет бандла после роста (described in DEVELOPMENT.md) |

Переиспользовано без повторного исполнения: `review-light-golden` /
`validate-gate` (https://github.com/Matysh/houseplan-card/actions/runs/40721621816)
подтверждает план проверок материала целиком, включая 3 strict Golden сцены
AC8 и product/tooling/docs CI — не пересчитывался, так как материал,
среда и oracle не изменились с момента этого прогона.

Не запускал: полный `gate:small`, mutation execution (`mutants execution=0` —
по хендоффу это осознанно не запрашивалось, автор сам пишет "выполнение не
запрашивалось. Локальный CI-reader подтверждает proof, не семантический CODE
verdict" — это честно названная граница автора, не моя находка), E2E (автор
обоснованно пометил "не надо": протокол/persisted-результат не меняются, с
чем я согласен после чтения `_opPointerUp`/`_commitPhysicalGeometry`).

## Находки

### Medium (в скоупе) — дублирующая запись в CHANGELOG RU/EN

`docs/CHANGELOG.md:8-9` и `docs/CHANGELOG.ru.md:14-15`: в разделе
«Unreleased»/«Не выпущено» для #1097 идут подряд ДВЕ почти идентичные
строки (пустая строка перед обеими отделяет их от соседних записей #1098/#1101)
— вторая строка полностью включает текст первой плюс дополнительное
предложение про pan/zoom/повороты. Похоже на черновую правку, где первая
версия строки не была удалена при добавлении уточнённой. Итог: одна и та же
пользовательская возможность #1097 описана дважды в обоих файлах
одновременно — читатель changelog увидит дубль. ТЗ требует «CHANGELOG RU/EN
одной строкой с #1097» (§ Release-артефакты) — это нарушено буквально (строк
две, не одна) в обоих файлах синхронно. Не влияет на корректность продукта,
но это реальная, воспроизводимая находка по изменённому файлу из
`changedFiles`, не вкусовщина.

Воспроизведение: открыть `docs/CHANGELOG.md`, раздел «Unreleased», строки
8 и 9; тот же дубль в `docs/CHANGELOG.ru.md`, строки 14 и 15.

Это Medium в скоупе → возврат автору (жёлтый вердикт), отдельный issue не
заводится.

## Что проверено и корректно

- **AC1/AC3 (0 сборок на кадре, соседи не остывают).** Независимо прослежено
  через код (стабильный `_floorKey` на время драфта → тёплый `_wallUnionGeometry`/
  `_physicalBodiesR`, fallback не трогает `_floorCacheBuilds`/`_wallUnionPool`) и
  подтверждено исполнением `smoke_opening_drag.mjs` (30 native pointermove,
  `unchanged()` проверяет `builds.wallUnion/physicalBodies/innerContour/
  cleanFloor/lightBarrier` и `pool` на каждом кадре, плюс отдельный цикл по
  соседним этажам `warm neighbour never rebuilds`).
- **AC2 (вырез следует за проёмом, итог побайтно тот же).** Прочитан
  `OpeningDragWalls.prepare/render`; подтверждено смоуком (`cut.centerEmpty`,
  `cut.shoulderSolid`, `symbol`, `released.openings` сравнивается
  `deepEqual` с `test/data/1097-opening-drag-baseline.json`).
- **AC4 (перегородка, `host.t`).** `smoke_partition_openings_preview.mjs`
  зелёный на этом материале; код `OpeningDragWalls` для `host.kind==='partition'`
  прочитан (строки 171-182, 192-196 `opening-drag-preview.ts`).
- **AC5 (отмена/отказ не пишут и не строят).** Unit (`opening-drag.test.mjs`:
  cancel/pointercancel/navigation/stale epoch/replaced record/≤3px) и смоук
  (native Escape, CDP trusted touchcancel, outside-wall refusal, backend
  reject с rollback/toast) — оба зелёные на этом материале.
- **AC6 (fallback виден счётчиком, соседние жесты не меняются).** Прочитан
  явный путь `_openingDragFallbackBuilds++` (`houseplan-editor-runtime.ts:6103`),
  отдельный от канонических счётчиков; негативный unit
  `opening-drag.test.mjs:104-121` целенаправленно бьёт в `host-not-found` и
  проверяет и счётчик, и байтовое совпадение с прямым вызовом
  `wallBodiesUnionPath`/`physicalBodyParts`.
- **rawPatches/non-enumerable риск (скрытый).** Проверен конкретно (см.
  «Как проверялось») — фикс корректен и покрыт прямым unit-тестом.
- **Документация.** `docs/CANVAS.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
  `docs/ARCHITECTURE.md` получили абзацы, согласующиеся с кодом (ссылки на
  реальные счётчики/файлы, не фантазии). `docs/release-ledger/v1.82.0/1097.json`
  — классификация `stable-fix` обоснована чтением стабильной `_opPointerMoveNow`
  (бампала epoch на кадре) и соответствует формату соседних записей (#1098).
- **Typecheck/build.** `build:build`, `build:test`, `build:typecheck` зелёные
  на этом материале (мной, адресно).

## Чего не проверял

- Полный `gate:small`/ночную mutation-матрицу — вне объёма ревью (§8:
  «Полные наборы — предрелизный гейт»); материал уже прошёл `validate-gate`
  целиком на этом SHA.
- `demo/benchmark_opening_drag.mjs` — не перезапускал; порог приёмки AC7 —
  счётчики (AC1/AC3), а не миллисекунды, они уже проверены адресно; таймингам
  в хендоффе доверяю как описательным, не приёмочным.
- Остальные ~30 "соседних" smoke из AC6 (`smoke_node_history_context`,
  `smoke_device_contact_live_drag`, `benchmark_wall_node_drag`,
  `benchmark_safe_resize*`) — не перезапускал; это предсуществующие
  негативные witness'ы, не изменённые этим диффом, и материал уже прошёл их
  в зафиксированном `validate-gate`-прогоне; независимо перепроверил только
  один представитель той же категории (`smoke_floor_cache_reuse`) как риск
  регрессии кэша и он зелёный.
- Golden AC8 (3 strict unchanged + 3 перенесённых before/after сравнения) —
  не перезапускал побайтовые PNG-сравнения; авторские SHA256 и
  `validate-gate` proof приняты как покрытие, т.к. ни один риск из моей
  независимой трассировки кода не указывает на визуальное отличие settled-пути
  (settled-рендер идёт тем же `_wallUnionGeometry()`, что и раньше).

## Решение

Yellow: один Medium в скоупе (дублирующая строка в обоих CHANGELOG). Код,
тесты и трассировка логики самого жеста — без находок; реализация
соответствует контракту ТЗ п.1–6 на независимую проверку. Маршрут — fix
(возврат автору на исправление дубля в CHANGELOG).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjQzMTRmMzUyNzg3OTUwOWE2YWQwMDkwNzMwNjU0OGZkN2M2ZmEyNDgyMDkwNzRhZGFkYTQ3M2FlYzlmMWVhMTMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwYzEzYThjOGExOTA0Y2Y3MmE3ZjRiODY1Yzk5Y2Q2YjI2ODc3OGRmZTM3MTBhNGMwMWExMTgzYzIxZDk0YjQyIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIzMTEzNWYwODRhNzg2OGVlYTAyN2RiM2RlNzY3ZTRhMzMzOWVhZGRiIiwidHJlZSI6ImM2NWRiODIxZWRkYjQwMjI5Yjg3MDJiODAwMmQxYTgyNmFhYWVhNWQiLCJib2R5RGlnZXN0IjoiMWRmN2MwZGZlZDc2YzNmMTk5ZTY0MmM3YTkzOWQwYWRiMDU3ZTYzN2VlYWMyYjA5Njc3YTlkZDdkYjYzMTk3MCIsInByb2R1Y2VyUnVuIjoiNDA3MjQ3NDk2NzciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImMwNWU4NjQ2ZjZlNDg5MWVhZWI1MjI3NTc2ZGFjNWZjNjU3NWNmNmYwNWVmMjNhNDJiNTY2YzJkZTA2NTU2MjMiLCJ2ZXJkaWN0RGlnZXN0IjoiNjRjOGJjMjc2NjRjYTAzYzc0ZDlmYzk4MmNkMGY4NjljMTc0ZWI2NTcxNzI4ZjYwZjAwYjZkZjU5OTI2ODlkYiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiYjk2OGMxNzVhYjZlODM5NjIxOTA3NjdmNDk2NDA5ZTEzZjFmNmU0NzU0ODE3ZTk4OWUzYmM1ZWQyYjIxM2RkIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDc0OTA3NDIyLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk3I2lzc3VlY29tbWVudC02NDc0OTA3NDIyIiwiYm9keURpZ2VzdCI6IjgyY2Q1OTllZDJmOWVjYjA2ZjQyZjNhMzg1ZTdiZGNkZTZjYmU0ZTZiYzdmODY4MjcyZmYwODliNDU3YWE2M2MifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1097-opening-drag`, коммит `31135f084a78` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c65db821eddb40229b8702b8002d1a826aaaea5d`
  ```
  git log --all --format='%H %T' | grep c65db821eddb
  ```
- Тело issue: `1df7c0dfed76c3f199e642c7a939d0adb057e637eeac2b09677a9dd7db631970`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTE2LCJvdXRwdXRfdG9rZW5zIjoyNzU1MSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNTQ3MzcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo2NzU2NTQ3LCJjb3N0VXNkRXN0aW1hdGUiOjIuMjQ1OTk5NDAwMDAwMDAwNX1dLCJ0dXJucyI6NjgsImR1cmF0aW9uTXMiOjYwMzU4NywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuMjQ1OTk5NDAwMDAwMDAwNSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=116 output_tokens=27551 cache_creation_input_tokens=154737 cache_read_input_tokens=6756547 num_turns=68 -->
