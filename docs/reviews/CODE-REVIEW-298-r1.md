# CODE-REVIEW-298-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/298
- **Этап:** код-ревью (PROCESS.md §2.7), заход **r1**, блокирующих циклов израсходовано **0/4**
- **Ветка:** `issue/298-resize-wall-thickness`, реализация — коммит `3fb2edc9`
- **Ревьюер:** Claude (внешняя сессия, без контекста реализации)
- **ТЗ:** `docs/specs/298-resize-wall-thickness-carrier.md`, ревью ТЗ зелёное r2 (`docs/reviews/SPEC-REVIEW-298-r2.md`)

## Скоуп проверки

`git diff origin/dev...HEAD` = один продуктовый коммит `3fb2edc9`, класс A/B/C/D:

- `src/wall-thickness.ts` — `fixed-topology` режим `rekeyWallsAfterMove()`, новые
  `wallRecordCarrierViolations()` / `wallRecordsHaveCarrierCoverage()`;
- `src/houseplan-card.ts` — вызов rekey с `mode='fixed-topology'`, новый
  carrier/lattice preflight в `_rszApplyPreview()` перед принятием preview;
- `test/wall-thickness.test.mjs` — 4 новых теста;
- `demo/smoke_edit_walk.mjs` — обновление таблицы `KNOWN`;
- `scripts/mutation-gate.mjs` — новый мутант `safe-resize-wall-endpoints-affine-scaled`;
- `docs/{RESIZE,WALL-THICKNESS,TESTING,ARCHITECTURE,CHANGELOG,CHANGELOG.ru,USER-GUIDE,USER-GUIDE.ru}.md`,
  `docs/images/*` (скриншоты пересняты), `dist/`+`custom_components/.../houseplan-card.js` (класс D, синхронизированы).

Прочитано перед разбором: `docs/SCOPE.md` (J6), `AGENTS.md`, `PROCESS.md`,
тело issue #298 и все 8 комментариев (аналитика → ТЗ r1/r2 → реализация),
`docs/specs/298-resize-wall-thickness-carrier.md` целиком, `docs/RESIZE.md`,
`docs/WALL-THICKNESS.md` (диффы и итоговый текст).

Это первый заход код-ревью (r1) — разбор полный, разделов «Унаследовано
из r0» и «Закрытие раунда r0» не требуется (PROCESS.md §2.10 относится к
повторным заходам).

## Как проверялось (гейты)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто, без вывода |
| unit | `npm test` | `tests 1263, pass 1262, fail 0, skipped 1` |
| build + bundle parity | `npm run build && node scripts/bundle-sync.mjs && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | обе копии побайтово совпадают |
| docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| model invariants (сырой diff) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение (5): `smoke_decor_layer_order`, `smoke_drag_bounds`, `smoke_grid_snap`, `smoke_infinite_canvas`, `smoke_room_resize`; зарегистрированная связь (2): `smoke_resize_pointer_real_plan`, `smoke_resize_wall_thickness` |
| смоки из списка выше | `node demo/smoke_{decor_layer_order,drag_bounds,grid_snap,infinite_canvas,room_resize,resize_pointer_real_plan,resize_wall_thickness}.mjs` | все `OK`, без находок |
| AC6, шесть прогонов обхода правок | `node demo/smoke_edit_walk.mjs --seed {1,2,3}` (примечание ниже про `--plan`) | все 6 комбинаций (`walk_{second,first}_floor_seed{1,2,3}`) → `true`, `OK` |
| AC8, мутационный страж | `node scripts/mutation-gate.mjs --id=safe-resize-wall-endpoints-affine-scaled` | `тест покраснел, как обязан`, `поймано 1 из 1` |
| реестр мутантов | `node scripts/mutation-gate.mjs --check` | без ошибок регистрации |
| AC9, целевой перф | `node demo/benchmark_safe_resize.mjs` | `candidate p95 0.0123ms` vs `relativeLimit 4.97ms`; `commitPreflight p95 0.002ms` vs бюджет `75ms`; `"pass": true` |
| модельные инварианты на самих фикстурах | `node scripts/model-invariants.mjs --config test/fixtures/real-plan-second-floor.json --json` | одно нарушение — ранее известный `partition_over_room_wall` (#296), не новое |

**Примечание к AC6:** флаг `--plan` в `demo/smoke_edit_walk.mjs` декоративный —
скрипт всегда проходит обе фикстуры из `PLANS`, `--plan` нигде не читается
после парсинга. Шесть команд из AC6/issue физически выполняются как три
(`--seed 1/2/3`), каждая уже покрывает оба этажа; результат тот же. Это
существующее поведение скрипта, не тронутое этим диффом (диф правил только
таблицу `KNOWN`) — не блокирует, но AC6 в issue стоило бы переформулировать
при случае.

**Не прогонялось (и почему):**
- `npm run golden:verify` — визуальный результат не меняется (спецификация
  §11 явно фиксирует «новый golden baseline не ожидается»); скриншоты
  документации это подтверждают (пересняты штатной джобой, `check-docs`
  зелёный) и это единственный проверяемый здесь визуальный артефакт;
- `python -m pytest tests_backend` — диф не касается `custom_components/**/*.py`;
- `demo/benchmark_safe_resize_render.mjs` — новый код живёт в rekey/preflight
  над данными стен, не в рендер-слое; рендер-путь не тронут, а
  `benchmark_safe_resize.mjs` уже показывает, что commit-preflight (тот же
  новый код) дешёвый;
- полный `ls demo/smoke_*.mjs` набор (185 файлов) — не оправдан объёмом диффа
  (2 продуктовых файла, оба геометрических); выбор ограничен прямыми
  совпадениями/связями инструмента плюс явно названными в AC.

## Находки

### High-1 — AC4 (legacy/key-only записи) не реализован: fail-closed контракт §3.3 отсутствует, дефект воспроизводится

**Скоуп:** явно внутри задачи — раздел «Входит» ТЗ прямо называет
«fixed-topology rekey exact **и legacy** wall records» (docs/specs/298-…md
§6), а AC4 посвящён целиком этому классу записей.

**Что требует ТЗ (§3.3):** для legacy (только `key`, без `a/b`) записи
разрешён один-единственный перенос — точное совпадение старого ключа с целым
изменившимся edge. «Projected-midpoint перенос по относительной доле
запрещён… Если legacy key затронут, но whole-edge соответствие
неоднозначно, кандидат fail closed и не сохраняется.» AC4 требует отдельного
теста на этот отказ («pure unit и production-preview reject с нулём
config/history writes»).

**Что в коде:** блок обработки legacy-записей в `rekeyWallsAfterMove()`
(`src/wall-thickness.ts:732-761`) **не тронут этим диффом ни одной строкой** —
собственный комментарий кода (`// Move an unambiguous whole-edge key or
projected midpoint`) дословно описывает именно тот projected-midpoint
fallback, который §3.3 запрещает. Единственное, что меняется через `mode`, —
это то, ЧТО именно проецируется (`mapPoint`), но не факт, что вместо отказа
происходит проекция. При неоднозначном/неполном совпадении (`nk` не
вычислен) код молча оставляет **старый ключ без изменений**
(`out.push({ ...w, key: nk || w.key, … })`) — ни отказа кандидата, ни ошибки,
ни пометки для последующего carrier-preflight. Сам carrier-preflight
(`wallRecordCarrierViolations`) намеренно пропускает такие записи
(`entrySpan` возвращает `null` без `a/b`), поэтому никакого другого
защитного слоя для этого пути нет — ни в `_rszApplyPreview`, ни где-либо ещё
в live-пути.

**Воспроизведение (числа те же, что в задаче, только формат записи —
legacy):**

```js
// probe: боковая стена удлиняется с 80 до 92 шагов (тот же класс жеста,
// что в issue), legacy-запись хранит ключ, чуть отличающийся от точного
// текущего ключа ребра (тот самый класс дрейфа ключей #258/#279/#291) —
// поэтому быстрый путь `keyMoves.get(w.key)` промахивается и код уходит в
// запрещённый §3.3 fallback.
rekeyWallsAfterMove(
  [{ key: wallKey([1/480,0],[80-1/480,0], 1/240), cm: 22 }],
  [[[0,0],[80,0]]], [[[0,0],[92,0]]], 1/240, 1000, 'fixed-topology',
);
// → key остаётся "40.000000,0.000000@0.0000" (середина СТАРОЙ стены),
//   хотя новая стена [0,92] должна иметь середину в x=46.
//   Запись теперь описывает точку внутри удлинившейся стены, не привязанную
//   ни к одной вершине и не совпадающую с новым carrier-серединой — то есть
//   именно тот класс дефекта, ради которого заведён #298, просто для
//   legacy-хранения вместо exact.
```

Второй пробник показывает тот же провал для настоящей неоднозначности
(две коллинеарные затронутые edges с разными результатами для одной
legacy-точки): вместо отказа кандидата ключ остаётся байт-в-байт старым.

**Почему это не гипотетика:** legacy-записи — не мёртвый код: `WallEntry.a/b`
опциональны специально ради старых, ни разу не тронутых новым write-путём
конфигураций (см. собственные комментарии `wall-thickness.ts` про
compatibility), а обе фикстуры для смоков (`real-plan-{first,second}-floor.json`)
проверены мной напрямую — **в них 0 legacy-записей**, поэтому AC6
(шесть прогонов обхода правок) физически не может обнаружить этот путь.
Отсюда и отсутствие сигнала «всё зелено» ничего не доказывает про этот
класс данных.

**Требуется для исправления в этой же задаче:** legacy-путь должен либо
явно возвращать признак «кандидат невозможен» (пробрасываемый до
`_rszApplyPreview` как отказ, а не молчаливое сохранение старого ключа),
либо carrier-preflight должен перестать пропускать legacy-записи. Плюс
тесты AC4 (unit на «unambiguous whole-edge», «untouched», «ambiguous midpoint
→ fail closed», «production-preview reject с нулём writes»), которых сейчас
в диффе нет вовсе.

### High-2 — AC2 не доказан: нет отдельного теста на репродукцию первого этажа

**Скоуп:** явно внутри задачи. AC2 ТЗ: «На `real-plan-first-floor.json`
последовательность `room-b`, edge 0, `x=49 → 52` не создаёт endpoint
`59.538`… Доказательство: **отдельный** fixture-backed regression с exact
endpoint, carrier/lattice и unchanged-record assertions.» То же самое
Evidence 2 из тела issue («Свидетельство 2 — первый этаж») требует теста,
который «обязан падать на текущем коде» (issue, AC5/issue-нумерация).

**Что в диффе:** `test/wall-thickness.test.mjs` получил ровно 4 новых теста
(`grep` по всему диффу подтверждает). Три из них про механику
(`never scales`, `translates every breakpoint`, `preserves an unrelated
record`) и один — про carrier coverage. Тест `never scales an interior
side-wall endpoint` использует числа `-85`/`-100..100`/`-96..100` — это
**второй этаж** (Evidence 1 из issue, тот же y=304, тот же -85). Ни один
тест, ни в этом файле, ни в остальном диффе (`git diff` по `test/` и `demo/`
не содержит строк `59.538`, `room-b`, `first-floor` рядом с числами
`17/52/57/101`), не воспроизводит **первый этаж** — конкретные числа
`49→52`, `17/52/57/101`, `59.538` нигде не встречаются.

Общий обход `smoke_edit_walk.mjs` (AC6) реально гоняет обе фикстуры и
зелёный, но это недостаточное доказательство именно этого AC: обход
детерминированно генерирует свою последовательность шагов по семени, а не
воспроизводит **именно** «room-b, edge 0, x 49→52», и не делает
покомпонентного assert «конкретная identity записи до/после», которого
явно требует формулировка AC.

**Почему это блокирует, а не Low:** AC2 — один из двух явно перечисленных в
issue «обязаны падать на текущем коде» репродукций. Раз ревью кода отвечает
на вопрос «оно вообще работает» по каждому AC (PROCESS.md §2.7), а для
второго из двух заявленных дефектных жестов пруфа нет вообще — AC2 не может
быть засчитан выполненным по чтению кода: степень уверенности в конкретно
этой фикстуре (`real-plan-first-floor.json`, `room-b`) ниже, чем во второй,
и не подтверждена ни одним новым тестом.

## Что проверено и корректно

- **AC1 (эквивалент AC2, но для второго этажа):** воспроизведено —
  `test/wall-thickness.test.mjs:611-627` использует ровно числа issue
  (`-85`/`-82.457`, `y=304`), affine-режим действительно проецирует
  пропорционально (тест это явно проверяет через `assert.notDeepEqual`),
  `fixed-topology` режим сохраняет запись byte-equivalent.
- **AC3 (untouched exact records):** `preserves an unrelated exact record
  byte-semantically` — `assert.deepEqual(next, [wall])`, дословное
  совпадение объекта, ключ включён. Конфликт-резолюция нескольких
  перекрывающихся `moves` на один атом (`candidates.slice(1).some(...)`,
  `src/wall-thickness.ts:685-691`) — код не тронут этим диффом, откат к
  исходному атому вместо выбора по порядку — поведение унаследовано из
  до-#298 кода и покрыто существующим тестом «issue 253 key collisions never
  erase…»; проверено чтением, не исполнением отдельно для этого диффа.
- **AC5 (carrier preflight покрывает весь span, не только концы):** новый
  тест `carrier proof covers collinear chains and rejects gaps or off-grid
  endpoints` — три сценария (цепочка из двух коллинеарных carriers, разрыв
  между ними, истинно off-grid координата) подтверждены прогоном, разрыв и
  off-grid реально даю `false`. Табличное покрытие уже (нет отдельного кейса
  «endpoint на independent partition» и «conflicting shared destinations»),
  но базовый механизм (полное покрытие интервала, а не только концов/
  midpoint) доказан — держу как Low, не блокирует.
- **AC6:** лично прогнал все шесть комбинаций (`--seed 1/2/3` × обе
  фикстуры внутри каждого прогона) — `off_lattice_coordinate` и
  `wall_carrier` из `KNOWN` действительно исчезли, остался только независимый
  `mixed_role_record` (#299), что соответствует ТЗ и не маскируется под
  результат этой задачи.
- **AC7 (атомарность preview/commit):** не появилось нового отдельного
  теста именно на «forced carrier failure → 0 writes», но:
  (а) новый carrier-guard использует тот же существующий, уже
  протестированный контракт `{ ok: false, reason: 'wall-metadata' }`, что и
  ранее существовавшая проверка сохранности `cm` (`src/houseplan-card.ts:8556`,
  не новая в этом диффе) — тот же путь отказа, та же атомарность;
  (б) `smoke_resize_pointer_real_plan.mjs` (не изменён этим диффом, но
  прогнан мной заново на новом коде) зелёный целиком, включая
  preview/commit/Undo/Redo на реальной фикстуре. Прямого forced-reject
  сценария именно для нового carrier-guard нет — это Medium-по-полноте
  наблюдение, снимаю с записью здесь, а не как блокер: атомарность
  инфраструктуры отказа не новая, она унаследована и уже нагружена другими
  причинами отказа.
- **AC8 (мутационный страж):** новый мутант
  `safe-resize-wall-endpoints-affine-scaled` действительно ловится только
  тестами `issue 298` — прогнал `--id=` явно, гард покраснел при мутации,
  «поймано 1 из 1».
- **AC9 (перф):** прогнал `benchmark_safe_resize.mjs` — новый carrier-код
  добавляет исчезающе малую стоимость (`commitPreflight` p95 0.002мс против
  бюджета 75мс), запас на три порядка.
- **Гейты процесса:** typecheck/test/build/bundle-parity/check-docs зелёные;
  единственный коммит несёт `Issue: #298` и `User-Visible: yes`, оба
  changelog правлены тем же коммитом; `docs/RESIZE.md`,
  `docs/WALL-THICKNESS.md`, `docs/TESTING.md`, `docs/ARCHITECTURE.md`,
  `docs/USER-GUIDE{,.ru}.md` обновлены содержательно и без выдуманных
  утверждений о поведении, которого нет в коде (сверено построчно с
  реализацией).
- **Одно число — один источник:** этот дифф не добавляет новую
  пользовательски видимую величину (толщина `cm` как была, так и осталась
  единственным хранимым числом; координаты `a/b` — внутреннее хранение, не
  показываются пользователю напрямую) — `test/single-source-numbers.test.mjs`
  прошёл в общем прогоне `npm test`, отдельного нового риска не вижу.
- **Touch/UX/i18n:** новых контролов, ключей или состояний нет (сверено с
  §5.3/UX-раздела ТЗ), в диффе действительно не добавлено ни одного i18n
  ключа и ни одного нового UI-текста, что подтверждает содержание диффа.

## Чего не проверял

- Полный `golden:verify` и полный browser-smoke матрица (185 файлов) — не
  оправданы объёмом/природой диффа, см. таблицу гейтов выше;
- backend/Python — диф их не касается;
- реальный HA harness (Linux CI/WSL) — вне ревью кода, это пред-релизный
  гейт;
- `demo/benchmark_safe_resize_render.mjs` — рендер-путь не тронут этим
  диффом;
- поведение на конфигурациях **с** legacy-записями в проде за пределами
  сконструированных мной проб — таких фикстур в репозитории нет; это и есть
  суть находки High-1.

## Вердикт

Оба High-финдинга — прямое следствие того, что заявленный в ТЗ и AC скоуп
(«legacy wall records» в AC4, отдельная first-floor репродукция в AC2) не
доведён до конца: код для legacy-записей не переписан под fixed-topology
контракт (хотя раздел «Входит» ТЗ его туда явно включает и демонстрируемо
воспроизводит тот же класс дефекта, ради которого заведена задача), а вторая
из двух явно поимённых в issue репродукций не имеет теста вовсе. Оба
находятся в скоупе этой же задачи и чинятся в ней же — не отдельным issue.

**Вердикт: красный · заход r1 · блокирующих циклов 0/4 · High: 2 · Medium: 0 → в задаче**
