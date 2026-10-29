# CODE-REVIEW-1123-r1

**Issue:** #1123 — [mutation-gate] отказ прогона по расписанию: 2026-10-29
**Трек:** show · **Этап:** code · **Заход:** r1 · блокирующих циклов 0/2
**Материал:** `5b1c2c106a1b2fc16723e2058228c71b997c885b` (база `08b154115ff815062cfc0221f39f7e53545dbe45`)
**Классы:** B (gates/tooling) + C (docs), ноль A — инфраструктурная задача, входит сразу в S7 (PROCESS.md §1)

## Скоуп

Ремонт ночных мутационных свидетелей после отказа прогона 40829602818 (18/20
шардов красные, шард 12 прерван). Диффу затронуты только:
`scripts/mutation-registry.mjs`, `scripts/ci-registry-inventory.json`,
`demo/smoke_decor_multiselect.mjs`, `demo/smoke_device_equal_spacing.mjs`,
`demo/smoke_view_hold_lifecycle.mjs`, `test/node-history-runtime.test.mjs`,
`docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/release-ledger/v1.82.0/1123.json`.
`src/**` не тронут. User-Visible: no — подтверждается отсутствием правок
`docs/CHANGELOG*.md`, согласуется со скоупом (J-строка `docs/SCOPE.md` не
применима — задача не продуктовая).

## Независимый разбор (до сопоставления с хендоффом)

Прочитан каждый `find`-паттерн из изменённых определений `mutation-registry.mjs`
против текущего `src/**` (построчно, не по авторскому списку):

| id | файл патча | `find` в источнике |
|---|---|---|
| `static-store-revision-echo-reloads-1112` | `src/config-store.ts:127` | совпадает |
| `zigbee-incomplete-heading-enlarged-1005` | `src/hp-zigbee-topology-settings.ts:70` | совпадает |
| `room-co2-loses-explicit-snapshot-source` | `src/render-snapshot-consumers.ts:33` | совпадает |
| `spacing-write-differs-from-the-shown-point` | `src/houseplan-card.ts:7798` | совпадает |
| `placement-accepts-any-mouse-button` (оба патча) | `src/houseplan-card.ts:7374` | совпадает |
| `align-point-reads-frozen-snapshot` | `src/houseplan-card.ts:13030` | совпадает, рядом сохранился поясняющий комментарий #521 |
| `decor-line-lost-capture-ignored-1046` (оба патча) | `src/houseplan-card.ts:11561,11563` | совпадает |
| `decor-history-rebuilds-physical-walls-1075` | `src/houseplan-editor-runtime.ts:2410` | совпадает |
| `replaced-stage-keeps-old-resize-observer-1093` | `src/houseplan-card.ts:4635` | совпадает |
| `late-room-save-closes-new-owner-1093` | `src/editors/room-save.ts:73` (сам catch-блок) | совпадает, прочитан весь `saveRoomEdit` |

Для трёх патчей с заменой `false`/`false &&` (decor-history-1075,
static-store-1112, replaced-stage-1093) проверено, что новая запись
(`host._pendingPhysicalWrites.size < 0`, `rev < knownRev`, `!this._resizeTargets`)
— рантайм-условие, не компайл-тайм константа: это именно устраняет TS-narrowing
отказ подготовки, о котором говорит issue («ошибка подготовки до заявленного
теста»), сохраняя тот же дефект по смыслу.

Единственный пункт с остаточной неопределённостью: `align-point-reads-frozen-snapshot`.
Комментарий реестра говорит «`_pos(d, false)` явно читает settled-координаты».
По месту объявления `_pos` (`houseplan-card.ts:5831`) второй параметр называется
`contacts` и управляет наложением device-contacts сдвига, а не выбором
live/frozen — выбор между `_renderDeviceSnapshot` и `_livePos` не зависит от
этого аргумента. Собственный читаемый по коду механизм (`_visibleDeviceSnapshot`
обновляется только на «settled» рендере, #1093/#813) делает правдоподобным,
что дефект всё равно воспроизводим (оба вызова разделяют один и тот же
`captured ?? _livePos` путь), но не исключает, что реальная разница теперь — в
contacts-сдвиге, а не в заморозке. Поимку по общей политике #709/#905
подтверждает только ночь; патч применяется к существующему тексту без ошибки,
большего по статике утверждать нельзя — отмечаю как «проверено чтением, с
открытым техническим нюансом», не как находку.

## Исполненные проверки (адресно, не повторяя непригодное)

Исходный хендофф заявлял смоки/юниты зелёными без подтверждения компиляции;
`unit:test/node-history-runtime.test.mjs` сначала **упал** (`test-build` не
собран в этой сессии — `ERR_MODULE_NOT_FOUND`), а оба browser-смока —
по таймауту `page.waitForFunction` (демо-бандл не собран). Это не находка по
коду, а отсутствие предпосылки исполнения в данной ревью-сессии; после
`build:test` и `build:build`+`build:bundle:sync` все три целевых проверки и
unit дали чистый PASS:

| Проверка | Результат |
|---|---|
| `build:test`, `build:build`, `build:bundle:sync` | PASS (подготовка) |
| `unit:test/node-history-runtime.test.mjs` | **PASS 25/25** — подтверждает авторское число |
| `smoke:demo/smoke_device_equal_spacing.mjs` | **PASS** — все `ac6SmallZoom*` true, остальные 55 полей true |
| `smoke:demo/smoke_decor_multiselect.mjs` | **PASS** |
| `smoke:demo/smoke_view_hold_lifecycle.mjs` | **PASS**, включая новые `hidden-only*` поля |
| `static:mutation-registry` | PASS (2052 определения, синтаксис/структура реестра валидны) |
| `static:ci-registry-inventory` | PASS (генератор подтверждает добавленный путь, профили byte-identical) |
| `static:toolchain-pins` | Chromium/Playwright ok; Python minor-расхождение не относится к диффу |

Три изменённых demo-файла и единственный изменённый unit-файл — это все
risky hunks диффа; остальные 7 ordinary guard'ов из хендоффа (`smoke_room_co2`,
`smoke_align_guides`, `smoke_decor_line_click`, `smoke_furniture_polish`,
`smoke_zigbee_incomplete_reasons`, `smoke_selective_invalidation_authority`,
`smoke_wallthick_standalone`) не изменены этим диффом — их PASS переиспользован
из авторского прогона (gate:small/pre-push), повторно не гонял.

Не прогонял и не могу прогнать штатно в этой среде:
- `node scripts/mutation-gate.mjs --check` / исполнение самих мутантов — явно
  запрещено вне ночного workflow (#709/#905); реестр синтаксически корректен
  (`static:mutation-registry` PASS), поимка — за следующей ночью.
- `static:status-snapshot` — упал локально с «snapshot block is stale»; сам
  скрипт документирует, что `--check` не предназначен для shallow-checkout
  (`git tag` недоступен), это ограничение среды ревью, не дефект STATUS.md.
- `static:smoke-select` — требует `--base/--head`, которые этот фиксированный
  раннер не передаёт; риск уже закрыт прямым запуском трёх изменённых смоков.
- Полное тело коммитов/трейлеры `Issue:`/`User-Visible:` — в доступном
  тулинге нет чтения сырых commit-сообщений (только `read:log` — oneline);
  доверяю авторскому `process-gate.mjs --issues → PASS`, указанному в
  хендоффе, как переиспользуемому доказательству, отдельно не перепроверял.

## Release-ledger и классификация

`docs/release-ledger/v1.82.0/1123.json`: `category: "infra"`, `baseStable:
"v1.82.0"` — соответствует формату и базе соседних записей той же бета-линии
(`1120.json`, `1121.json`, `1122.json`, `1125.json`, тоже `v1.82.0`). Нулевой
class A, User-Visible: no — milestone релиза не затрагивается (§11.9).

## Что проверено и корректно

- Все `find`-паттерны реестра совпадают с текущим `src/**` построчно — патчи
  применятся в ночь, а не провалятся на этапе `apply` (это и было корнем части
  прежних «свидетелей без доказательства»).
- Новый blok AC6 в `smoke_device_equal_spacing.mjs` содержит нетривиальную
  предпосылку (`ac6SmallZoomInputCrossesGridMidpoint`), не vacuous-true —
  исполнением подтверждено, что сценарий действительно пересекает узел решётки
  на минимальном зуме и что Undo/Redo восстанавливают показанную, а не
  «сырую» точку.
- Правка `smoke_decor_multiselect.mjs` закрывает именно описанный дефект:
  старый `inputs.filter(x=>!x.value).every(...)` был vacuously true на пустой
  выборке; новый вариант требует `inputs.length===expected` и непустой
  `placeholder`/границы поля.
- `hidden-only` в `smoke_view_hold_lifecycle.mjs` действительно не вызывает
  `pagehide` (ветка `if (kind==='hidden')` не совпадает с `'hidden-only'`),
  исполнением подтверждено отдельное покрытие visibility-only retirement.
- Три «literal false» патча заменены на рантайм-эквиваленты, не ломающие
  TS-narrowing/компиляцию — само исправление устраняет причину «ошибка
  подготовки», названную в issue.
- Scope class B/C, ноль A, нет миграции/UX-контракта/touch-perf влияния.

## Чего не проверял (честная граница)

- Фактическую поимку (`caught`) зарегистрированных мутантов — запрещено вне
  ночного workflow; остаётся за штатным ночным прогоном (#709/#905).
- Точный технический механизм `align-point-reads-frozen-snapshot` (см. раздел
  разбора выше) — проверено чтением без исполнения мутанта, с названной
  неопределённостью.
- Полное содержимое commit-трейлеров `Issue:`/`User-Visible:` — инструмент не
  даёт читать сырые сообщения коммитов; полагаюсь на авторский
  `process-gate.mjs --issues → PASS`.
- `pytest tests_backend`, Golden, invariants — не относится к диффу (нет
  Python/геометрии/визуальных изменений), не прогонялись намеренно.

## Маршрут (§5)

Задача инфраструктурная (ноль class A, User-Visible: no), не вводит новый
UX-контракт, конфиг-миграцию, не касается touch/perf-контракта; ожидаемое
поведение (что чинится и почему) зафиксировано в `docs/DEVELOPMENT.md` и
`docs/STATUS.md` этим же диффом. Все пять критериев §5 пройдены →
`route: fix`.

## Побочные находки

Политика: `mode=issues`. Побочных находок Medium вне скоупа не обнаружено —
`outside_findings` пуст.

---

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-1123-r1.md**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImQyMzQ3Y2JlMjlmOWU2Njg0ZWY4ZmVjNWU3MzMyZjEyMjRiZGQ2MDE0ZGI0NGNkN2I4OTk2NzQxZGViZjgwMzgiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0NDhkNDQ1MWE0NzQ5MjJkY2JlYTgyZWNiMjMzYTJlMTI4Y2FlNzVlZWQwMDM3YjQwNjlhOTJkYTllMjM1MjJlIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTIzLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1YjFjMmMxMDZhMWIyZmMxNjcyM2UyMDU4MjI4YzcxYjk5N2M4ODViIiwidHJlZSI6ImJlNmJlYTE1MTAyZDUxNDIxYmJlMDg2OGY0ZTI4MDA0MDBhMjcwYjEiLCJib2R5RGlnZXN0IjoiNzFmNGE0MDkyOTk5ODFlNjdjN2M0YzFjNjg5N2U5NzIzOThiNmFkMTgxNDMxOTk4MzgzMDdjNzA1N2RmZWE0NCIsInByb2R1Y2VyUnVuIjoiNDA5NDEyNDA2NzEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImQ0YjM2YTVmNGMzODIwNTY0NGQyNDFiNjkzYjY4ZDVhYjVjYzY0ODJiZDkzMDdmNjU3NzdkOGU2YjEyNGFhNmQiLCJ2ZXJkaWN0RGlnZXN0IjoiNzUyMzY4OGNmYjY0M2Q3YjdkY2JjNGYxODg0NWQ1MzlmZTc1ZDQ5N2ZjODZlN2E3NzU1OWMwMzcyMjQ1NmVjNyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI2OWE0Nzg3MzdjZDhhZjhmM2FiZTFiNDU3ZWJjODg5NjE1NzFmMDc2ZDI0ZDYwZWEyMTQxMzYwODFlY2ExNjEwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTA2ODYwNDYzLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTIzI2lzc3VlY29tbWVudC02NTA2ODYwNDYzIiwiYm9keURpZ2VzdCI6IjdkNzgxZWJmZTMwY2FmMTQ2ZDVlYzM1YzAyMjI5YjY0OWYzYWIzZmM4NDYyMGE0NWEzZThkNDYxOTcxM2EzOTEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1123-nightly-mutation-witnesses`, коммит `5b1c2c106a1b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `be6bea15102d51421bbe0868f4e2800400a270b1`
  ```
  git log --all --format='%H %T' | grep be6bea15102d
  ```
- Тело issue: `71f4a409299981e67c7c4c1c6897e972398b6ad18143199838307c7057dfea44`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40941240671,"run_attempt":1,"digest":"1786cbf78133a128a9bfb5059420fe702ac281399a19452f191519866d232f61"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTAwLCJvdXRwdXRfdG9rZW5zIjo0NzIyNiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxOTQ2NDAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo2MTIzNTg5LCJjb3N0VXNkRXN0aW1hdGUiOjIuNDc1NzM3OH1dLCJ0dXJucyI6ODIsImR1cmF0aW9uTXMiOjEwMjg1NjUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjQ3NTczNzgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=100 output_tokens=47226 cache_creation_input_tokens=194640 cache_read_input_tokens=6123589 num_turns=82 -->
