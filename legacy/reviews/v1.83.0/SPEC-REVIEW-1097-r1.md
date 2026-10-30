# SPEC-REVIEW-1097-r1

Issue: #1097 · Этап: spec · Трек: ask · Заход: r1 · Материал: тело issue #1097
(bodyDigest `1df7c0dfed76c3f199e642c7a939d0adb057e637eeac2b09677a9dd7db631970`),
основа dev `09bda8dbee8b50577bfc4affc332b8cda914f5b4` (рабочая копия на нём же).

## Скоуп ревью

ТЗ редакции 1 на ускорение live-жеста перетаскивания проёма (дверь/окно/проход)
вдоль стены комнаты или перегородки: вместо полного union стен этажа на каждый
отрисованный кадр — локальная перерезка тела-хозяина, по образцу
`resizePreviewWalls`. Коммит, валидация, Undo, Resize/узлы/перегородки/колонны,
лестницы/LED, бэкенд и touch-контракт — явный не-скоуп. Кодовый Validate на
этапе spec не требуется (политика `ciEvidence.contextOnly`); оценивалась
осуществимость и доказуемость AC чтением материала.

## Как проверялось

Статическое чтение изменяемых файлов на точном SHA материала (без исполнения
кода — реализации ещё нет) плюс одна адресная проверка осуществимости: ровно
то, что требует §8 для spec-этапа — осуществимость AC и реалистичность ссылок
на код/фикстуры.

Прочитано и сверено построчно с материалом (`09bda8dbe`):

| Утверждение ТЗ | Файл:строки в ТЗ | Факт в материале |
|---|---|---|
| `_opPointerMoveNow` правит `cfg.x/y/angle`/`cfg.host.t` в записи этажа и бампает `_cfgEpoch` при изменившемся кадре | `houseplan-editor-runtime.ts:6071-6143` | Подтверждено: `src/houseplan-editor-runtime.ts:6071-6146`, прямая мутация `cfg` из `_curSpaceCfg.openings`, `_cfgEpoch++` на `:6118`/`:6144` только при `changed`/`geometryChanged` |
| `activeEditorGesture` включает `_opDrag` | `live-editor.ts:112-117` | Точное совпадение, `src/live-editor.ts:112-117` |
| Live-кадр рисует `_renderWallBodies(display)` только при `_opDrag` | `live-editor.ts:272-274` | Точное совпадение, `src/live-editor.ts:274`: `${host._opDrag ? host._renderWallBodies(display) : nothing}` |
| `_wallUnionGeometry` кэширована по `wallUnionKey(floorKey, roomCount)`, миссы пишутся в `writeWallUnionPool` | `houseplan-card.ts:9177-9204` | Точное совпадение диапазона и механики, `src/houseplan-card.ts:9177-9204` |
| `openings` входят в ключ физики (`physicalFloorFingerprint`/`physicalSpaceRecord`) | не процитирован файл, но утверждается прямо | Подтверждено: `src/structural-space-record.ts` исключает из структурного проецирования только `decor`/`title`(+ `name`/`area` комнаты) — `openings` не исключены, значит входят в фингерпринт каждого кадра |
| `WALL_UNION_POOL_LIMIT = 8` | `floor-geometry-key.ts:112` | Точное совпадение, `src/floor-geometry-key.ts:112` |
| Resize уже чинит это локально через `resizePreviewWalls`, полный union — один раз на коммите | `live-editor.ts:178-246` | Подтверждено, `src/live-editor.ts:180-248` |
| `large-house`: 20 комнат, 49 стен, 34 проёма на этаже | без ссылки на файл | Подтверждено численно: `demo/fixtures/large-house.mjs` — `ROOMS_PER_FLOOR=20`; `OPENING_COUNT=100` при `FLOOR_COUNT=3` даёт `ceil(100/3)=34` на первый этаж; количество уникальных сегментов стен 4×5-сетки комнат даёт 49 (`wallSegments`) |
| Счётчики `_floorCacheBuilds.wallUnion/physicalBodies/innerContour/cleanFloor/lightBarrier` существуют как тестовый seam | п. 1 контракта, AC1 | Все пять существуют в `src/houseplan-card.ts` (`:9193`, `:9839`, `:9232`, `:9865`, `:10733`) и уже читаются смоками через `demo/helpers/hp-test.mjs` (например `demo/smoke_floor_cache_reuse.mjs`) — инфраструктура для AC1/AC3 уже есть, новых seam-примитивов не требуется |
| `physicalBodies` неизбежно растёт вместе с `wallUnion` сегодня | контракт п.1 | Подтверждено: `_wallUnionGeometry` сама вызывает `this._physicalBodiesR()` (`:9181`) перед сборкой union — согласованно с тем, что AC1 требует остановки обоих счётчиков одним и тем же фиксом |
| `lightBarrier` не растёт на кадре уже сегодня (не регресс, а неизменное) | контракт п.1, AC1 (там его нет) | Правдоподобно: `_lightBarriers`/глоу не входят в `planTemplate` (живой слой редактора), а полный Lit-рендер диверится от обычного апдейта во время жеста (`routeHouseplanEditorUpdate`) — поэтому его нет в списке AC1 (там нечему краснеть), но контракт п.1 верно требует его не трогать как общую гарантию |
| Поименованные demo/test файлы существуют и не требуют новых ожиданий | план автотестов | Подтверждено `Glob`: `smoke_opening_preview.mjs`, `smoke_opening_measure.mjs`, `smoke_partition_openings.mjs`, `smoke_partition_openings_preview.mjs`, `benchmark_wall_node_drag.mjs`, `benchmark_safe_resize.mjs`, `benchmark_safe_resize_render.mjs`, `smoke_floor_cache_reuse.mjs`, `smoke_node_history_context.mjs`, `smoke_device_contact_live_drag.mjs`, `test/physical-body-gesture.test.mjs` — все на месте |
| Release-ledger v1.82.0: соседняя задача #1093 (тот же участок кэшей) — `stable-fix` | раздел Release-артефакты | Подтверждено чтением `docs/release-ledger/v1.82.0/1093.json` (`"category": "stable-fix"`) — предположение ТЗ о вероятной классификации #1097 согласовано с прецедентом на той же подсистеме |

Адресная проверка осуществимости (единственная, по конкретному непокрытому
вопросу «не задвоит ли фикс нагрузку на `openingTunnel`/`openingWallIndex`,
раз они не входят в список «не растут» счётчиков п.1»): прочитан
`_renderOpeningTunnelFills` (`houseplan-card.ts:9387-9416`) — у него отдельный,
дешёвый на уровне одного проёма ключ (`openingWallIndexKey` + геометрия
проёма), не связанный с `_wallUnionGeometry`; это не floor-wide пересчёт,
поэтому их отсутствие в контракте п.1 корректно, а не пробел. Вопрос снят
чтением, без исполнения.

Прочитаны целиком обязательные источники роли (`docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`) и тело issue из `REVIEW_CONTEXT`.

## Находки

### Low-1 — неверный номер Core user job в разделе «Сценарий»

ТЗ пишет: «Жест — **J4** из SCOPE (обслуживание существующего плана),
desktop-first по TOUCH-SUPPORT». Формулировка в скобках («обслуживание
существующего плана») дословно пересказывает **J6** — «Keep the plan true as
the home evolves» (`docs/SCOPE.md`: «new-device flag, three editors (plan,
devices, background), **drag/resize**, merge/split, multi-client live sync,
optimistic locking»). **J4** — это «From zero to a working plan in one evening»
(первичный онбординг: импорт изображения, мастер этажей, авто-расстановка),
к перетаскиванию уже существующего проёма отношения не имеет.

Содержательно задача обслуживает ровно ту работу, которую описывает (J6,
drag/resize в уже существующем плане) — само обоснование верное, ошибочен
только индекс job. Последствий для AC, скоупа или доказательств нет: это
опечатка в ссылочном номере первого (продуктового) раздела ТЗ, которая не
меняет ни один наблюдаемый пользователем результат и не затрагивает ни один
AC. Снимаю сам, правится следующей редакцией одной цифрой («J4» → «J6»), цикл
не открывает.

Других несоответствий документам, недоказуемых или неоднозначных AC,
непомеченных как предположение поведенческих утверждений не найдено.

## Что проверено и корректно

- Обязательные разделы §7.1 присутствуют все: сценарий, что человек увидит до
  и после, проблема, скоуп/не-скоуп, контракт поведения, UX, модель данных и
  миграция, i18n, AC1–AC8 с доказательством, план автотестов, риски, откат,
  release-артефакты.
- Каждый AC однозначен и привязан к конкретному наблюдаемому результату
  (счётчик, байт-в-байт запись, набор ключей пула, toast) и к конкретной
  команде/файлу доказательства; для всех защитных AC (AC1, AC3, AC5, AC6)
  таблица содержит и «чем доказан», и «чем краснеет» — явный обязательный
  RED на неизменённой базе для AC1/AC3, явные негативные входы для AC5/AC6
  (fallback по счётчику, Esc/cancel/<3px). Пустых третьих столбцов нет.
- Технические ссылки на код (номера строк, имена функций, названия
  счётчиков, ключ пула, лимит пула) выверены построчно против материала на
  точном SHA `09bda8dbe` — расхождений не найдено (см. таблицу выше); это
  означает, что аудит #1094, на который опирается ТЗ, описывает актуальное
  поведение, а не устаревший срез.
- Численные параметры фикстуры (`20 комнат, 49 стен, 34 проёма на этаже`)
  арифметически выводятся из `demo/fixtures/large-house.mjs` — не придуманы.
  «Один источник числа» (§8) соблюдён: оба раза число опирается на одну и ту
  же фикстуру, отдельного второго источника той же величины в ТЗ нет.
  Величина в мс (575–624 мс из аудита #1094) приведена только как контекст
  проблемы, а не как порог приёмки — AC7 прямо отказывается от
  миллисекундного порога в пользу счётчиков AC1, что исключает флаки
  бенчмарка как блокер приёмки.
- Инфраструктура для доказательства (`_floorCacheBuilds`, его публичный
  тестовый доступ через `demo/helpers/hp-test.mjs`, уже используемый
  существующими smoke-тестами того же семейства) реально существует —
  план автотестов не описывает несуществующий seam.
- Не-скоуп перечислен явно и не пересекается с соседними задачами (#1098,
  #1099, #1100), ссылки на них по номеру присутствуют.
- «Принято предположительно» фиксирует именно то, что по правилу §7.1
  агенты решают сами (где живёт preview-состояние, чем строится локальный
  вырез, порядок публикации бенчмарка) — не продуктовая неоднозначность,
  владельцу эскалировать нечего; открытых вопросов владельцу в ТЗ нет,
  задача закрыла их сама этим разделом.
- Touch-контракт не меняется по существу: сценарий описывает desktop-first
  жест теми же pointer-обработчиками, что и touch-путь — согласовано с
  `docs/SCOPE.md`/`TOUCH-SUPPORT.md` без необходимости отдельного AC.
- Release-ledger классификация «предположительно stable-fix» согласована с
  прецедентом #1093 на том же кэш-семействе в `docs/release-ledger/v1.82.0/`.

## Чего не проверял

- Исполнение любого кода (тесты, бенчмарк, gate:small, tsc, build) —
  реализации ещё нет, этап spec кодовый Validate не требует. Гейты не
  запускал: это сознательное решение по политике этапа
  (`ciEvidence.contextOnly: true`, «кодовый Validate на этапе spec не
  требуется»), а не пропуск.
- `mcp__houseplan_review__run_check` не вызывался: ни один доступный check
  (`unit:*`, `static:*`) не был соразмерной проверкой осуществимости ТЗ без
  реализации — единственный непокрытый вопрос (нагрузка на
  `openingTunnel`/`openingWallIndex`) снят чтением кода, а не исполнением.
- Точный текст комментария аудита #1094 (6441041060) с цифрой 575–624 мс не
  запрашивался из внешнего источника — это фон проблемы, не AC-порог, и
  политика запрещает угадывать/запрашивать внешние URL не из материала.
- Будущий текст CHANGELOG/`docs/CANVAS.md`/`docs/DEVELOPMENT.md` абзацев —
  предмет кода, не ТЗ; отмечу только, что на момент этого ревью
  `resizePreviewWalls` ещё не упомянут ни в `docs/CANVAS.md`, ни в
  `docs/DEVELOPMENT.md` (абзаца «рядом с которым» разместить новый текст,
  сегодня не существует) — не блокер, исполнителю нужно будет добавить и
  описание resize-механизма тоже, либо разместить новый абзац автономно.

## Гейты

Этап spec, кодовый Validate не требуется. Прогнано: ничего из
build/test/tsc/gate:small — не требуется политикой этапа и не оправдано
конкретным непокрытым вопросом (единственный такой вопрос снят адресным
чтением кода, см. выше). Проверка осуществимости выполнена целиком статическим
чтением материала на точном SHA (`Read`/`Grep`/`Glob`) — ссылки на
код/счётчики/фикстуры/demo-файлы и численные параметры сверены построчно и
арифметически, расхождений не найдено.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/SPEC-REVIEW-1097-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjViNzcyNjcwZGE0MGI3MTA1N2RkNTNkNjYwZjYyYmUyYmZmYTBkZDhlMzNmNjc2YzcyZWE5NTJkYjgwZWM1NWMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0MmY4MjVlYzI3MGQ1NGMzYmQ2OGNkZjE4ODdhYzhhYTNhZTQxOTQzNmQ3MDg1NzVjMWI4ZjFhZDMyNDk4Y2JlIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk3LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwOWJkYThkYmVlOGI1MDU3N2JmYzRhZmZjMzMyYjhjZGE5MTRmNWI0IiwidHJlZSI6ImE2NWQ4YmU5M2I2ZTY0NGZhNmYzZGUzZTQxMmJlOTRmZDYwNTdjZTkiLCJib2R5RGlnZXN0IjoiMWRmN2MwZGZlZDc2YzNmMTk5ZTY0MmM3YTkzOWQwYWRiMDU3ZTYzN2VlYWMyYjA5Njc3YTlkZDdkYjYzMTk3MCIsInByb2R1Y2VyUnVuIjoiNDA2NTA2MTI0MjMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImU1NDE1ZTI3NTk0YTEzYmMwYzMxNGIxZmY4MDU5Y2Q1YWQ5MjFkYWI4NThmZDk4ZTI0ZDhlNzY1ZDA0ZWZjYzQiLCJ2ZXJkaWN0RGlnZXN0IjoiMmViYmEyMmI3OTJhNzY1MTE1NGFmZGQyZmUxMTNlMjZlNTk1YjRiOGZkZDgzYTYxNTAzM2EwMDMzM2E2YjUwOSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIwOGU4ZmQ1ZDk5YzZmZjVhYWMyYTE0YjJlNDkyODllNWRkNDhiMTM1OWVkNDQ0MjUxNDdhOTk5ZmEyZjFlMGZmIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDYzNDk0NjcxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk3I2lzc3VlY29tbWVudC02NDYzNDk0NjcxIiwiYm9keURpZ2VzdCI6ImM2MTBjZDdhM2ViMmY1ZGQzNGMzMzQ0MTYyOTAyZDQ5YzcxZmQ3MzQzMzUzNmZmMjc4ZWMxMjFiNTA2ZDgzOTYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `09bda8dbee8b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a65d8be93b6e644fa6f3de3e412be94fd6057ce9`
  ```
  git log --all --format='%H %T' | grep a65d8be93b6e
  ```
- Тело issue: `1df7c0dfed76c3f199e642c7a939d0adb057e637eeac2b09677a9dd7db631970`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjYsIm91dHB1dF90b2tlbnMiOjM3NDk2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0MTk5NiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMxMjExMDUsImNvc3RVc2RFc3RpbWF0ZSI6MS41NjcyOTcwMDAwMDAwMDA0fV0sInR1cm5zIjo1NywiZHVyYXRpb25NcyI6NDY2MzAyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS41NjcyOTcwMDAwMDAwMDA0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=66 output_tokens=37496 cache_creation_input_tokens=141996 cache_read_input_tokens=3121105 num_turns=57 -->
