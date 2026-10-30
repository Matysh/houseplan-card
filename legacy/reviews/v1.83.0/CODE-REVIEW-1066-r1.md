# CODE-REVIEW-1066-r1

Материал: `89c2935913e0c8abc426f9df9c5199e42c729fd6` (tree
`e64424a47bfac2a116cfa942e723592ed66d2f39`), диапазон `origin/dev..HEAD` — пять
коммитов (`git log --oneline`):

```
89c293591 docs(status): refresh snapshot after pipeline repair
b8637a648 test(diagnostics): verify retained daycycle measurement archives
5e758c2cc docs(diagnostics): retain bounded daycycle evidence and offline comparison
a3b115dd5 fix(diagnostics): register offline input ownership and keep live geometry explicit
b9ba87eb7 feat(diagnostics): retain passive daycycle camera and raster observations
```

Трек: `show` (метка владельца, инфраструктурная P2-задача без класса A входит на
`S7-code-review`). Этап: `code`. Заход r1, блокирующих циклов 0/2.

## Скоуп

22 изменённых файла, все классы **B** (`demo/helpers/daycycle-{analysis,
diagnostics,observation}.mjs`, `demo/smoke_daycycle_raster.mjs`,
`scripts/daycycle-compare.mjs`, `test/daycycle-diagnostics.test.mjs`,
`.github/workflows/{validate,validate-product,validate-tooling}.yml`,
`scripts/ci-profile-paths.json`, `scripts/ci-registry-inventory.json`) и **C**
(`docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/TESTING.md`, `docs/release-ledger/v1.82.0/1066.json`,
`docs/reviews/evidence-1066/**`). Класс **A** (`src/**`) не тронут ни одной
строкой — продукт не меняется, классы риска по участкам (geometry/touch/
migration/devices/perf/ux/visual) не вычисляются для несуществующего диффа A.

Задача — узкая диагностическая надстройка над существующим смоком
`smoke_daycycle_raster.mjs` (#863/#1066): пассивное наблюдение настоящего
native pan (pointer-события, два существующих rAF на шаг, реальные
viewBox/transform/style через MutationObserver, LayerTree backend-node ID,
GPU/resource provenance, выравнивание часов page/trace), офлайн-сравнение
сохранённых отчётов (`scripts/daycycle-compare.mjs`) и сохранение трёх
дистиллированных дампов расследования (`docs/reviews/evidence-1066/*.json.gz`
+ `index.json` + `README.md`). Исходный paired-ratio оракул
(`demo/helpers/daycycle-measurement.mjs`) не изменён ни строкой.

## Как проверялось

| Гейт | Статус | Где видно |
|---|---|---|
| `read:diff` / `read:log` на точном SHA | PASS, материал неизменён | `mcp__houseplan_review__run_check`, receipts `fd473012…`/`d76f19d9…` |
| `unit:test/daycycle-diagnostics.test.mjs` (адресный прогон новой защитной тестовой группы) | PASS, 13/13, 209 мс | независимый перезапуск ревьюером через `run_check`, receipt `9bd150ae-fbd0-4a61-881d-c14465d0bd2d` |
| `validate-gate` на точном материале `89c293591…` | SUCCESS (переиспользован) | https://github.com/Matysh/houseplan-card/actions/runs/40249245791 (docs/product/tooling триплет: 40249245900/40249245791/40249245850) |
| Browser job селективных смоков на этом материале, включая `smoke_daycycle_raster` | PASS (из хендоффа: job121337899051, 9/9, daycycle 00:28:31Z, artifact 12619848776) | переиспользовано — адресный повторный браузерный прогон не требовался: единственный риск (влияет ли новая CDP-инструментация на измеренный ratio) уже закрыт сохранённым `docs/reviews/evidence-1066/{ci,wsl}.json.gz`, оба на том же инструментированном коде, ratio 1.21/1.28 ≪ 2.0 |
| Инварианты геометрии / pytest backend / golden | не прогонялись — не применимо: ни геометрия, ни Python, ни рендер-пути не менялись (§8) |
| Полный `npm test`/`gate:small` целиком | не повторялся — покрыт переиспользуемым `validate-gate` того же SHA (tooling job: 2354 теста, 2353 PASS/0 FAIL/1 опциональный SKIP, включая все 13 новых кейсов #1066) |
| Трейлеры `Issue:#1066`/`User-Visible:` | косвенно OK: CHANGELOG(.ru).md не тронуты ⇒ `User-Visible: no`, заголовки коммитов конвенциональны (`feat/fix/test/docs(diagnostics)`); побайтовый `git log --format` с телами коммитов недоступен ревьюеру через предоставленный набор `run_check` — отмечено как «проверено чтением заголовков, не полного тела коммитов» |
| `docs/release-ledger/v1.82.0/1066.json` | OK | `category: "infra"`, без `introducedBy`, формат идентичен соседним `1065.json`/`1067.json`; верно не получает milestone |
| Одно число — один источник (STATUS Tests) | OK | `5557→5570` (+13) совпадает ровно с числом новых `test(...)` в `test/daycycle-diagnostics.test.mjs`; сгенерировано `status-snapshot.mjs`, ручного дублирования числа нет |

## Независимый разбор кода

- **Отсутствие продукта в диффе.** `git diff --stat` не содержит `src/**`;
  единственный продуктовый файл, на который ссылается расследование
  (`src/live-viewport.ts`), не менялся — сверено чтением:
  `LIVE_VIEWBOX_REFRESH_MS = 100` и `LIVE_VIEWBOX_REFRESH_SHIFT = 0.15`
  (`src/live-viewport.ts:84,86`) совпадают с механизмом, который описывают
  `docs/reviews/evidence-1066/README.md` и `docs/ARCHITECTURE.md` — документация
  расследования не выдумывает несуществующий код.
- **Наблюдение не пишет в продукт.** `installDaycycleObservation`
  (`demo/helpers/daycycle-observation.mjs`) слушает `pointerdown/move/up/cancel`
  с `{capture:true, passive:true}` и `MutationObserver({subtree:true,
  attributeOldValue:true})` — только чтение; `demo/helpers/daycycle-diagnostics.mjs`
  использует только read-only CDP-команды (`SystemInfo.getInfo`,
  `LayerTree.enable/disable`, `DOM.describeNode`, `Runtime.evaluate/releaseObject`).
  Тестовая фикстура `pageFixture()` в `test/daycycle-diagnostics.test.mjs`
  делает `setAttribute()` кидающим исключение — прогон подтвердил `f.writes === 0`:
  обычный red-capable negative case, не мутант.
- **Пейс/вход не меняются.** `observeDaycycleFrames` (новый хелпер) делает ровно
  тот же двойной `requestAnimationFrame`, что и прежний инлайн-промис в
  `smoke_daycycle_raster.mjs` (проверено диффом: старый блок убран, новый вызов
  передаёт `step` только для записи временной метки) — тест подтверждает
  `f.scheduled.length` ровно 1 после первого кадра («exactly the existing second
  frame»), лишних кадров/CDP-вызовов на шаг не добавлено.
- **Обработка CDP-состояния между замерами.** `measurePan` поднимает
  `beginDaycycleLayers`/`installDaycycleObservation` и глушит их
  (`layerObservation.stop()`, `window.__hpDaycycleObservation.stop()`) в каждом
  из 6 вызовов `measurePan`; `LayerTree.disable` вызывается только если
  `LayerTree.enable` успел пройти — утечки состояния между раундами нет,
  подтверждено и логикой, и отдельными тестами absent/available LayerTree.
  Включение `LayerTree.enable`/доп. категория трассировки `blink.user_timing`
  происходит **до** `performance.now()`-метки начала замера и симметрично для
  static/daynight пар — системная погрешность overhead ложится на обе половины
  отношения одинаково; этот риск («не раздувает ли новая CDP-инструментация
  измеренный ratio») закрыт не рассуждением, а данными: оба сохранённых
  `ci.json.gz`/`wsl.json.gz` сняты **этим же** инструментированным кодом
  (`index.json.sourceBlobs` указывает ровно на блобы этого коммита) и дают
  1.214590/1.281960 — заметно ниже потолка 2.0 и исходного красного 2.414350.
- **Запись отчёта не теряется при падении check().** В `smoke_daycycle_raster.mjs`
  `writeFileSync(path, …, {flag:'wx'})` выполняется **до** цикла
  `for (…) check(name, value)`, то есть raw-JSON сохраняется независимо от
  исхода любого `check()` — соответствует заявленному в `docs/DEVELOPMENT.md`
  «CI saves the standalone raw report on success and failure» и подтверждает
  смысл нового шага workflow `if: always()` / `if-no-files-found: ignore`.
  CI-дефолтный путь `artifacts/diagnostics/863/daycycle-${run}-${attempt}-${job}-${pid}.json`
  уникален на процесс — коллизий между шардами/ретраями нет.
- **Workflow-правки не ломают существующий гейт.** Новый путь
  `artifacts/diagnostics/863` добавлен в уже существующий шаг с
  `if-no-files-found: error` («Preserve selected progress report»,
  `validate.yml:940-949`) рядом с `artifacts/browser-selected`/`artifacts/golden`;
  `actions/upload-artifact` требует непустого результата по **объединению**
  путей, а не по каждому пути отдельно — отсутствие диагностики в тех
  прогонах, где daycycle-смок не выбран, не уронит шаг. Отдельный новый шаг
  в per-shard `smoke`-джобе использует `if-no-files-found: ignore` — там риска
  нет вовсе.
- **Генерируемые инвентари.** `scripts/ci-registry-inventory.json` получил
  `demo/helpers/daycycle-{diagnostics,observation}.mjs`, но **не**
  `demo/helpers/daycycle-analysis.mjs` — проверено чтением
  `scripts/ci-registry-inventory.mjs`: список строится статическим обходом
  зависимостей от зарегистрированных смоков (`inputsOf`/`reusableFrontendInputs`),
  а `daycycle-analysis.mjs` используется только из `scripts/daycycle-compare.mjs`
  (CLI) и теста, а не импортируется самим браузерным смоком — отсутствие
  записи соответствует алгоритму генератора, не расхождение. Файл — генерируемый,
  несвежесть кидает `Error('stale registry inventory…')`; зафиксированный
  зелёный `validate-gate`/tooling-прогон на этом SHA не оставляет такой ошибки
  непойманной.
- **Защитные тесты умеют падать.** В `test/daycycle-diagnostics.test.mjs`
  каждый контракт из хендоффа подтверждён обычным (не мутационным)
  отрицательным входом, который реально меняет итог: посторонний
  `materialSha`/отсутствующий `tree` → `matching.*=false`; `pointers[0].trusted=false`,
  отсутствующий кадр, пустая/отключённая/вне-root геометрия → `status:
  'incomplete'`; «исторический» отчёт без `diagnostics.page` → `status:
  'unavailable'` при сохранении исходного `rasterRatioWithinBudget:false`;
  битый JSON во входном файле CLI → `SyntaxError`. Прогон подтвердил 13/13 PASS
  (см. таблицу гейтов) — это не просто «тест существует», а воспроизведённое
  исполнение.

Рискованных гипотез (реальное окружение vs фикстура, холодный/прогретый старт,
отмена/гонка) с отдельным непокрытым пробелом не нашлось: единственный
нетривиальный риск этой задачи — «не искажает ли сама диагностика измеряемую
величину» — закрыт данными, а не предположением (см. выше).

## Находки

High: 0. Medium (в скоупе): 0.

Таблица «AC · чем доказан · чем краснеет» для всех четырёх защитных контрактов
присутствует в хендоффе и подтверждена исполнением (не пустая, не голое
«Verified»):

| Контракт | Чем доказан | Чем краснеет |
|---|---|---|
| Исходный RED не переобъявляется PASS | `#1066 unavailable historical telemetry does not rehabilitate an original valid RED` | обычный тест, red при регрессии: `ratio=2.4`/`pass=false` остаются неизменными после прогона через офлайн-анализатор |
| Разные источники не считаются совпадающими | `#1066 comparison refuses to call foreign source or absent tree matching` | `matching.source`/`matching.tree` падают в `false` на чужом SHA |
| Пробелы наблюдения явно `unknown`/`incomplete` | `#1066 absent trust, missing frames/geometry and clock provenance remain incomplete/unknown` | каждая из 6 параметризованных порч входа даёт `status:'incomplete'` |
| Чтение не фильтрует/не переписывает данные | `#1066 CLI reads plain/gzipped evidence and compactly reports every original sample and verdict` | битый JSON → `SyntaxError`; `readFileSync(plain)` байт-в-байт не изменился после прогона |

## Побочные находки

Доверенный снимок политики (REVIEW_FINDINGS_POLICY): `mode=issues`, issue
#1066, round 1 — совпадает с встроенным в промпт снимком, расхождений нет.
Маршрут: типизированные `outside_findings` для доверенного publisher.
Находок вне скоупа диффа не обнаружено — весь дифф относится к одной
диагностической подсистеме (#1066/#863), посторонних файлов не затронуто.
`outside_findings: []`.

## Что проверено и корректно

- Весь дифф — классы B/C, продукт (`src/**`) не затронут; это подтверждает
  заявленную автором классификацию `A=0`.
- Исходный ceiling (2.0), 60 шагов, три чередующиеся пары, `median` парных
  отношений и guard `measurementProblems` в `daycycle-measurement.mjs` не
  изменены ни одной строкой; новые поля (`materialTree`, `diagnosticEnvironment`)
  проходят в отчёт через `{...input}` и не участвуют в вычислении
  `measurementValid`/`rasterRatioWithinBudget`.
- Пассивное наблюдение не пишет в продуктовый DOM, не добавляет кадры/CDP-вызовы
  на шаг пана, корректно поднимается и глушится на каждом из 6 раундов.
- Отчёт на диск пишется до любых `check()`-выходов — CI действительно сохраняет
  raw-evidence и при PASS, и при FAIL, как заявлено в документации.
- Новые воркфлоу-шаги не создают риска `if-no-files-found: error` для уже
  существующего шага (семантика объединения путей `upload-artifact`).
- Release-ledger запись (`category: infra`) и отсутствие записи в CHANGELOG
  взаимно согласованы (`User-Visible: no`); число `Node unit 5570` в STATUS —
  с одним источником (генератор), совпадает с 13 новыми тестами диффа.
- Защитные тесты (13/13, независимо перезапущены) реально умеют краснеть на
  обычных отрицательных входах — не голые PASS.

## Чего не проверял

- Полный `npm test`/`gate:small`/browser full-matrix/golden/performance целиком
  — не требуется объёмом правки (§8), покрыто переиспользуемым `validate-gate`
  того же SHA (docs/product/tooling триплет SUCCESS).
- Повторный браузерный прогон `smoke_daycycle_raster.mjs` — не перезапускал
  (180 с реального Chromium); единственный относящийся к нему риск (влияние
  новой CDP-инструментации на ratio) закрыт сохранёнными `ci.json.gz`/
  `wsl.json.gz`, снятыми тем же кодом, плюс заявленным PASS той же площадки в
  хендоффе — отдельного непокрытого пробела для адресного повтора не нашёл.
- Полные тела коммитов (`Issue:`/`User-Visible:` трейлеры built from `git log
  --format=full`) — недоступны через предоставленный набор `run_check`;
  проверено косвенно (заголовки, отсутствие правок CHANGELOG). Явно отмечаю
  это как границу, а не как «проверено».
- Историческую причину исходного CI-отказа (конкретный scheduler/resource
  триггер) — сам issue и README честно называют её неизвестной; это вне
  границ задачи (пункт 2 узкого scope — отдельная будущая задача), не предмет
  этого ревью.

## Маршрут

`route: fix`. Задача проходит все критерии §5 трека `show`: сложность низкая
(три новых read-only хелпера + один тест + воркфлоу/доки, без продукта),
одна поверхность (диагностическая надстройка над одним смоком), нет миграции
конфига, нет нового UX-контракта (вообще нет изменения пользовательского
поведения — `src/**` не тронут), нет влияния на производительность/touch
продукта (overhead измерен, раскрыт как ограничение, симметричен для обеих
половин отношения, не меняет сам продукт), ожидаемое поведение зафиксировано
в самом issue (раздел «Узкий scope диагностики») и задокументировано этим же
коммитом (`docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`).

---

## Материал раунда

- Ветка: `issue/1066-daycycle-raster-diagnostics`, коммит `89c2935913e0c8abc426f9df9c5199e42c729fd6`.
- Дерево материала: `e64424a47bfac2a116cfa942e723592ed66d2f39`.
- Вердикт: `green` · High 0 · Medium 0 · маршрут `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6Ijg3YmI0ZWNkMzc1OWFhMDM3MDg5NjYwNmUzMTJkYWRlNGQyYzRhOGZhNzQ2NzBhZmJiZmU3YTA4Zjg4YWFkMzUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJjMDhjNjY0MDMxZThmYzQzOTE0NGM2M2E5NjE3YWM4MjU3NTE1NTNjNDVlNzI0NWE0NjVjMTJmYzg2OGRkYTk2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDY2LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI4OWMyOTM1OTEzZTBjOGFiYzQyNmY5ZGY5YzUxOTllNDJjNzI5ZmQ2IiwidHJlZSI6ImU2NDQyNGE0N2JmYWMyYTExNmNmYTk0MmU3MjM1OTJlZDY2ZDJmMzkiLCJib2R5RGlnZXN0IjoiYjUzODA3NmY1NGUyZjUzODBmNmZhNWIxY2M0NzRlNDZiNDk5ZWY1ODkyYzIwMDU2NGEzNWJiZWZhNTcwNWMzYiIsInByb2R1Y2VyUnVuIjoiNDAyNDk4MDEyNjIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijk0ZGFmZTc1NTBlYjk4M2ZkMjYzODQyMGU1NTlkNDQxOTMyMTBkMTIyMmMwODUwY2Y4NDVmZGNmYWE1NTA0ZTIiLCJ2ZXJkaWN0RGlnZXN0IjoiYmI3ZjYyYjU5ZDk1YzNkOTcxZTYxMWJkMWYzZGQ3NjU2YWY3Nzc0ZDhhY2RlZmUyMzJiN2Y5Y2U5ZThmMzdiZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJhN2YxMzdjOTQ5NTBlMmJmM2U3MmI1NTMxMzY1ZGZhMzhlZjQ0ZDJhZDZmNmY2M2M4NGNkNmQ5ZDZjNTkwYTI5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA1Njg1NDk2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDY2I2lzc3VlY29tbWVudC02NDA1Njg1NDk2IiwiYm9keURpZ2VzdCI6IjkwNGJjZjI1YjMyODc2YzEzNjhhODEzYzViNGMzMzVjZjU4M2I5YWM2Nzg2Zjg5ZGE4MTVkYzQxZjVkNmQxYjYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1066-daycycle-raster-diagnostics`, коммит `89c2935913e0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e64424a47bfac2a116cfa942e723592ed66d2f39`
  ```
  git log --all --format='%H %T' | grep e64424a47bfa
  ```
- Тело issue: `b538076f54e2f5380f6fa5b1cc474e46b499ef5892c200564a35bbefa5705c3b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40249801262,"run_attempt":1,"digest":"3cb512ee92e851452ba134c51cddfcf447aaff4a1698f55a04e55d164b26f008"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTQsIm91dHB1dF90b2tlbnMiOjM4MTQzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NDEwMCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMxMjcxMDksImNvc3RVc2RFc3RpbWF0ZSI6MS42NjMzNTk4fV0sInR1cm5zIjozNiwiZHVyYXRpb25NcyI6NDgyOTc3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42NjMzNTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=54 output_tokens=38143 cache_creation_input_tokens=164100 cache_read_input_tokens=3127109 num_turns=36 -->
