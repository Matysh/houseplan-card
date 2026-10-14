# CODE-REVIEW-888-r1

Материал раунда: SHA `6923860cfa05a747086339fc3a650b83e730233d` (ветка
`issue/888-connected-node-diagnostics`, рабочая копия на нём). Трек: show.
Заход r1, блокирующих циклов 0/2.

## Скоуп

Инфраструктурная задача B/C (`User-Visible: no`, ledger-категория `infra`
относительно `v1.80.1`, milestone пользовательского релиза не назначается).
По #888 чинится не продуктовая геометрия/perf, а диагностика пограничного
падения `demo/smoke_wall_node_connected.mjs` на CI (#898: бюджеты 55/121/150 мс
уже существуют и здесь не меняются). Три AC из тела issue:

- **AC1** — красный perf-verdict явно называет превышенный бюджет/факт/лимит/
  превышение; функциональные и clock-ошибки остаются отказом; граница
  "ровно на пороге" — зачёт; ретраи и повышение бюджета запрещены.
- **AC2** — read-only фазовая диагностика по уже существующим
  source/native/flush timestamps и точным ledger-identity; пропуски/
  неоднозначность → `unknown`; wall-time не выдаётся за CPU/compositor
  причину, superseded input не выдаётся за отдельный рендер.
- **AC3** — одна заранее объявленная серия ровно из 3 запусков в
  эксклюзивном окне на чистом материале, сохраняет все исходы и различает
  сравнимость материала/протокола/окружения; без retry-until-green.

Первый вопрос к `docs/SCOPE.md`: прямого product-job здесь нет — задача
инфраструктурная (CI-диагностика), обслуживает надёжность поставки, а не
строку Core user jobs напрямую; это ожидаемо для `infra`-задачи.

Изменённые файлы (`git diff origin/dev...HEAD`, 9 файлов): новые
`demo/helpers/node-performance-report.mjs`, `scripts/node-connected-diagnostics.mjs`,
`test/node-performance-report.test.mjs`, `docs/analysis/888-node-performance-2026-10-15.md`,
`docs/release-ledger/v1.80.1/888.json`; правки `demo/smoke_wall_node_connected.mjs`,
`demo/helpers/README-node-performance.md`, `docs/STATUS.md`, `docs/TESTING.md`.
Совпадает с перечнем файлов в хендоффе автора — расползания скоупа нет.
Оба коммита несут `Issue: #888` / `User-Visible: no`; changelog не нужен.

## Как проверялось

Validate на этом SHA зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/38642702992, `success`)
закрывает дешёвые гейты: фронтенд-джоб (tsc/`npm test`/build+bundle-policy)
прошёл за 5m26s; смоки/golden/pytest/parity в этом прогоне не запускались
(smoke-select не выбрал ни одного — см. ниже), что ожидаемо для диффа без
`src/**`. Их перегонять не стал.

Дополнительно в этом раунде:

| Гейт | Результат |
|---|---|
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — браузерные смоки не выбираются |
| `node --test test/node-performance-report.test.mjs` | PASS 7/7 |
| `node scripts/process-gate.mjs --issues` | PASS, 1 ожидаемое инфра-предупреждение (статусная метка не нужна до S7) |
| `node scripts/check-docs.mjs` | PASS (7 файлов, 14 внешних ссылок) |
| Отрицательная проба 1: `actual > limit` → `actual >= limit` в `nodeBudgetVerdict` | FAIL 1/7 (тест границы "ровно на пороге" покраснел), откат подтверждён `git status` чист |
| Отрицательная проба 2: убран `rows.length !== report.inputToPaint?.count` в `nodeLatencyAttribution` | FAIL 1/7 (тест на неполную/неоднозначную evidence покраснел), откат подтверждён |
| Отрицательная проба 3: убран `report.material.dirty !== false` в `signature()`, при **грязном материале во всех трёх** отчётах серии (сценарий вне теста автора, собран вручную) | на немодифицированном коде — `comparable:false` (верно); с вырезанной проверкой — `comparable:true` (ложноположительная сравнимость) — находка ниже |

### Чего не проверял и почему

- `npx tsc --noEmit`, `npm test`, `npm run build` целиком — закрыты зелёным
  Validate на этом же SHA (#343), перегонять не стал.
- `demo/smoke_wall_node_connected.mjs` (предварительно объявленная серия из
  трёх прогонов в эксклюзивном окне, AC3) — не перезапускал. Это не выбор
  "лень", а то, что сам протокол AC3 бронирует ровно одну такую серию в
  согласованном окне; повторный независимый прогон не был бы тем же
  доказательством и не заменил бы его. Сырые `artifacts/888-series/raw-*.json`
  не закоммичены (осознанно, живут в изолированном дереве реализации) —
  числа и SHA256 из них проверены только по тексту `docs/analysis/888-…md`,
  не по самим файлам.
- Golden/`ci:golden`, инварианты геометрии, `pytest tests_backend` — диффа в
  `src/**`, Python или рендере нет.
- Ночные мутанты — трек show их не гоняет никогда (#709); у задачи нет
  заявленных мутантов в реестре (диагностика/отчётность, не продуктовый
  инвариант).
- Свежесть скриншотов документации — не гейт задачи (#697).

## AC · чем доказано · чем краснеет

| AC | Чем доказано | Чем краснеет (проверено исполнением) |
|---|---|---|
| AC1 (бюджет, граница, функц./clock-ошибки — защитный) | `test/node-performance-report.test.mjs` тесты 1–2; прочитан код `nodeBudgetVerdict` | Мутация `actual > limit` → `actual >= limit` красит тест границы 1/7 (см. таблицу выше) |
| AC2 (точный join identity, `unknown` при пробеле — защитный) | тесты 3–4; прослежена арифметика теста 3 вручную против продакшн-схемы `settleNodeInputLedger`/paint-observer полей (совпадает буквально) | Мутация снятия проверки покрытия (`rows.length !== count`) красит тест 4 1/7 |
| AC3 (сравнимость серии, retry-until-green запрещён — защитный) | тесты 5–7; прочитан `nodeSeriesSummary`/`signature()` | Снятие `material.dirty !== false` не красит существующий тест (он меняет только один отчёт из трёх, и расхождение ловится побочно через хеш); на **равномерно грязной** тройке — ложное `comparable:true`. Находка ниже (Low) |
| "Никаких новых ретраев/повышения бюджета" (AC1/AC3) | прочитано: `budgets` в `demo/smoke_wall_node_connected.mjs` остались `{55,121,150}`, та же строка owner-decision #898; `nodeSeriesSummary` не содержит циклов повторного запуска, только производную сводку по переданным отчётам | проверено чтением, не исполнением — повторный запуск гейта тут нечем эмулировать, это свойство отсутствия кода, а не присутствия |

## Находки

### Low — тест сравнимости серии не ловит равномерно-грязный материал

`demo/helpers/node-performance-report.mjs`, `signature()`
(проверка `report.material.dirty !== false`) и соответствующий тест
`test/node-performance-report.test.mjs` (блок "foreign, dirty, partial...").
Существующий тест меняет `material.dirty` только у одного из трёх отчётов
серии — расхождение тогда ловится побочно через несовпадение хеша (`material`
целиком входит в подпись), а не через саму проверку "неизменный материал
должен быть чистым". Я вручную собрал тройку отчётов, где **все три**
имеют `material.dirty: true`: на действующем коде `nodeSeriesSummary` верно
вернул `comparable:false`; после удаления проверки — `comparable:true`
(подтверждено выше в таблице гейтов). То есть сам код сейчас корректен, но
тест этой конкретной защитной ветки нечувствителен к реалистичному сценарию
"весь прогон велся в грязном дереве" и не поймает будущую регрессию именно
здесь. Не блокирует: поведение на этом SHA правильное, воспроизведение — это
тест-гэп, а не дефект поведения, который увидит пользователь или ревьюер
читая отчёт. Оставляю как находку без действия автора в этом раунде
(трек show: "нечувствительный тест ... — Low и цикла не открывает").

## Что проверено и корректно

- `nodeBudgetVerdict` — точное сравнение без округления, равенство на пороге
  зачтено, функциональные/clock-ошибки (`report.failures`, `report.error`)
  остаются в списке причин, идемпотентен при повторном вызове (дедуп строк
  подтверждён тестом и вручную).
- `nodeLatencyAttribution` — схема консьюмера (`gesture.events[].{id,eventTime,
  dispatched,paintOpportunity}`, `gesture.inputs[].{id,eventTime,inputToPaintMs,
  disposition,coalesced}`, `gesture.samples[].{began,mainThreadMs,validateCalls,
  invalid,events}`, `gesture.sourceMatches[].{sourceId,observationId,
  observationIndex}`) сверена построчно с тем, что реально пишут неизменённые
  `settleNodeInputLedger` (`demo/helpers/node-input-ledger.mjs`) и слушатель
  `pointermove`/`flushMove` в самом смоке — совпадает полностью. Это не
  игрушечная функция поверх синтетики теста, а рабочая диагностика поверх
  настоящих полей продакшн-прогона.
- Арифметика теста "exact ledger join" (`sourceToNativeMs/nativeDispatchMs/
  frameSchedulingMs/candidateWallMs/afterCandidateToPaintMs`, сумма 46 мс)
  пересчитана вручную по входным данным фикстуры — сходится; это не
  тавтологическая проверка структуры, а проверка конкретных чисел.
  "Component p95s must not be added" и "superseded ≠ отдельный рендер"
  зафиксированы в `limitations`-тексте и в README.
  wall-time прямо не выдаётся за CPU/compositor-причину (отдельное поле
  `cause: 'unknown'`, нет его вычисления из таймстемпов).
- `nodeSeriesSummary`/`signature()` — три независимых чистых ресивита с
  одинаковыми material/protocol/workload/environment/budgets дают
  `comparable:true`; инородный sha, грязный worktree (хотя бы один отчёт),
  budgets/viewport/environment mismatch, неполный `raw`, `functionalChecks
  !== 'passed'`, менее трёх отчётов — всё даёт `false` (протестировано и
  прочитано).
- CLI `scripts/node-connected-diagnostics.mjs` — read-only (исходный файл не
  меняется, подтверждено тестом 7 через сравнение байт на диске), bounded
  (`rows` отрезан в выводе), корректные коды выхода (2 без аргументов, 1 на
  ошибку парсинга).
- Бюджеты 55/121/150 не менялись ни в коде, ни в README/STATUS/TESTING;
  исторические отчёты в `docs/analysis/...md` явно держат собственные старые
  пороги (50/100, 50/110), не подменены текущими.
- Трейлеры `Issue: #888`/`User-Visible: no` на обоих коммитах корректны;
  `docs/release-ledger/v1.80.1/888.json` — категория `infra`, без milestone,
  без `introducedBy` (задача не правит регрессию бета-функции) — соответствует
  прецеденту (#897).
- `smoke-select` подтверждает отсутствие исполняемого frontend-диффа —
  браузерные смоки действительно "нечего выбирать", а не "пропущены".
- Критерии §5 трека show (route): сложность/риск низкие и локализованы в
  одном модуле отчётности (surfaces — один), миграций конфига нет,
  нового UX-контракта нет, сама диагностика не влияет на производительность/
  touch-контракт продукта (бюджеты и геометрия не тронуты), поведение
  задокументировано в этом же диффе (`README-node-performance.md`,
  `docs/TESTING.md`). Переквалификация не требуется.

## Чего не проверял (сводно)

Полный browser-smoke набор, golden, инварианты геометрии, pytest backend,
ночные мутанты — см. таблицу выше с обоснованием по каждому пункту; все они
либо не затронуты диффом, либо покрыты иным механизмом (Validate на этом SHA,
предварительно объявленная серия AC3, бронируемая самим протоколом задачи).

---

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/CODE-REVIEW-888-r1.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/888-connected-node-diagnostics`, коммит `6923860cfa05` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `efa947f915b03fa209886d820415dc7c1b2b5269`
  ```
  git log --all --format='%H %T' | grep efa947f915b0
  ```
- Тело issue: `55a3c331703169310e08e1e4a7f1e98100107a1dd656126c5c63d2667768e46e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2ODAsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Nzg1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3OCwib3V0cHV0X3Rva2VucyI6Mzk4MzMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTIyMjU0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mzg1MjMxMywiY29zdFVzZEVzdGltYXRlIjoxLjY1Nzk2NDZ9XSwidHVybnMiOjUwLCJkdXJhdGlvbk1zIjo0NjM5NDksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjY2Mjc0OTYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4758 output_tokens=39854 cache_creation_input_tokens=122254 cache_read_input_tokens=3852313 num_turns=50 -->
