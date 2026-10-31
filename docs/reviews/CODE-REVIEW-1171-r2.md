# CODE-REVIEW #1171 — r2

Материал: `867202341202384e32666087bb957f7b18c132b5` (два новых коммита
после r1: `996d20930` docs: review document for #1171, `19f75084f`
fix(static): select the classic face per opening in line plans,
`867202341` docs: record M1 face regression and final capture evidence).
Трек: ask. Этап: code, заход r2, блокирующих циклов 1/4.

## Скоуп

Раунд закрывает единственный Medium из [CODE r1](CODE-REVIEW-1171-r1.md):
«space-level» построение `openingIndex` применялось ко всем непартиционным
проёмам без повторной проверки `type==='gate'`, из-за чего в пространстве
без физических стен (`walls.length===0`) с хотя бы одним wall-hosted
`gate` обычная дверь/окно получали ту же индексированную грань, что и
gate, расходясь со стороной, которую даёт полный план для той же
геометрии (AC2/п.2 ТЗ). Остальной скоуп (AC1, AC3–AC7) не менялся с r1 и
переносится по правилу «не инвалидировано находкой».

## Как проверялось

1. `read:log` — подтверждён состав: ровно два продуктовых/docs коммита
   после принятого r1 (`a712b39b1`), оба относятся к исправлению M1, без
   посторонних изменений.
2. `read:diff` (полный дифф материала против общего предка `33707db7a`)
   прочитан целиком; независимо прослежен итоговый `src/space-render.ts`
   построчно — не только дельта, а весь путь `renderSpaceStatic`,
   `staticOpeningFace`, `cachedStaticOpeningIndex`, `visibleSpec`,
   `openingBounds`, `openingSymbols`.
3. Исправление построчно сверено с эталоном — `_openingFace`/
   `_renderOpenings` в `src/houseplan-card.ts:8759-8768` и
   `src/houseplan-card.ts:13164-13169` (не изменены этим диффом):
   полный план выбирает индексированную грань по условию
   `o.partitionHost || walls.length || o.type==='gate'` **на каждый
   проём отдельно**; новая `staticOpeningFace(opening, index, hasWalls)`
   воспроизводит то же условие как `index && (hasWalls ||
   opening.type==='gate')` для каждого вызова `visibleSpec`, с `hasWalls
   = walls.length > 0`, вычисленным один раз для пространства (совпадает
   со space-wide `walls.length` полного плана). При `walls.length>0`
   обе ветви совпадают для всех типов; при `walls.length===0` обе дают
   классическую грань `{ox:0,oy:0,cm:0,side:-1}` для обычных
   door/window и индексированную — только для gate. Расхождение,
   описанное в M1, устранено на уровне чистой функции, а не только для
   конкретной фикстуры.
4. Отдельно проверен сопутствующий вызов `openingWallIndex(space.rooms,
   walls, zeroWalls.contour, …)` (не изменён этим диффом, существовал
   уже в r1): подтверждено по `src/houseplan-card.ts:9356-9358`
   (`_openCuts() { return this._zeroWalls().contour; }`) и
   `src/houseplan-card.ts:10456-10457`, что `zeroWalls.contour` —
   тот же объект, что полный план передаёт как `openCuts` в
   аналогичных путях без интерактивного инструмента (например,
   `_sunInputs`). Это не отдельная копия алгоритма и не новый риск.
5. Прочитан новый unit-тест `test/static-wall-openings.test.mjs`,
   кейс «#1171 M1: an indexed gate cannot change an ordinary line-plan
   opening face»: строит `walls=[]` фикстуру с одновременными
   `wall-door`/`shared-window`/`legacy-window` (обычные) и `outer-gate`
   (ворота), независимо вычисляет реальный индекс
   (`openingWallIndex(...)`), подтверждает, что индексная грань для
   двери **реально отличается** от классической (`assert.notDeepEqual`)
   — то есть сценарий не вырожденный, — затем проверяет, что
   `staticOpeningFace` для обычных проёмов возвращает классическую
   грань, а для gate и partition — соответствующую специальную. Это
   прямой свидетель именно того дефекта, который нашёл r1: до
   добавления per-opening guard `staticOpeningFace` вернул бы для
   двери ту же индексированную грань, что и для gate (`indexed !=
   classic`), и `assert.deepEqual(..., classic)` упал бы.
6. **Исполнено в этом раунде** (адресно, для закрытия конкретного
   пробела r1): `build:test` → exit 0; `unit:test/static-wall-
   openings.test.mjs` → exit 0, 4/4 PASS, включая именно M1-тест (TAP
   `ok 1 - #1171 M1: an indexed gate cannot change an ordinary
   line-plan opening face`). Это первый фактический исполненный
   прогон новой регрессии на точном материале `867202341` — ни один
   зелёный CI до этого раунда не содержал её отдельно как «проверено
   ревьюером», хотя она входила в общий прогон gate (см. ниже).
7. Прочитан новый `scripts/mutation-registry.mjs` guard
   `static-gate-leaks-indexed-face-to-line-openings-1171`: патч
   буквально убирает `hasWalls || opening.type === 'gate'` условие
   (`index ? … : …` вместо `index && (...) ? … : …`), guard —
   `node --test test/static-wall-openings.test.mjs`. Патч корректно
   нацелен ровно на устранённую строку; по чтению кода мутант обязан
   провалить именно M1-подтест (индекс при этом непустой и даёт
   `indexed != classic` для двери). Исполнение мутанта — ночной
   владелец (AC6), не повторено здесь; статическая регистрация
   корректна.
8. Прочитаны обновления `demo/fixtures/static-wall-openings.mjs`
   (`linePlan` опция обнуляет `walls`/`wall_segments`/`wall_ids`,
   сохраняя тот же состав проёмов, включая `outer-gate`),
   `demo/golden/static-wall-openings.mjs` (новая ветка `linePlan`
   проверяет masonry solid-точку `[.26,.5625]` вместо `[.16,.1875]`,
   то есть иную геометрию выреза без стен) и `demo/smoke_static_wall_
   openings.mjs` (параметр `linePlanFixture` подключён к прогону). Это
   даёт нативный (реальный браузер/продукционный бандл) кадр для того
   же сценария, не только чистый unit — подтверждено чтением сигнатур
   и логики проверки, без повторного запуска Chromium/Golden (вход —
   фикстура — новый по сравнению с r1, но сам нативный/browser-прогон
   уже зафиксирован зелёным на точном материале `867202341`
   validate-gate: https://github.com/Matysh/houseplan-card/actions/runs/41225580855,
   «review-light-golden proof is complete»; дополнительных browser-
   specific пробелов для этого AC не выявлено, поэтому повторный
   запуск Chromium не требовался).
9. Документация (`docs/ARCHITECTURE.md`, `docs/WALL-THICKNESS.md`,
   `docs/DEVELOPMENT.md`, `docs/CHANGELOG.md`/`.ru.md`,
   `docs/development-notes/static-wall-openings-1171.md`/`.json`,
   `docs/release-ledger/v1.83.0/1171.json`) прочитана целиком и сверена
   с кодом: формулировки «per-opening face selection», «gate may demand
   a contour index in a line plan, while ordinary… doors/windows still
   use the classic zero face» точно описывают реализованный фикс, без
   обещания несуществующего поведения. CHANGELOG RU/EN добавляют одно
   предложение («Mixed line plans with gates retain the full plan's
   orientation for every opening» / «На контурном плане с воротами
   ориентация каждого проёма также совпадает с полным планом») без
   числового значения, расходящегося между источниками (§8 — не
   применимо, числовых дублей нет). `release-ledger/v1.83.0/1171.json`
   получил 4-й golden-intent (`static-wall-openings-line-plan-phone-
   light`) с явным `reason`, указывающим на M1; `baseStable`/
   `category: stable-fix` не изменились и остаются корректными.
10. Сопоставлено с принятым `review-light-golden` proof
    (https://github.com/Matysh/houseplan-card/actions/runs/41225580855)
    и хендоффом: 12 focused + 74 targeted unit PASS, native smoke 24/24
    (включая смешанный line-plan сценарий), 4 Golden-сцены плюс 2
    strict full-plan control (0px/0ratio/0maxDelta), полный pre-push
    exit 0/250s/failed 0, CI product/tooling/docs GREEN на точном SHA.
    Proof подтверждает выполненные проверки; независимый разбор кода и
    адресный повторный unit-прогон (п. 6) проведены отдельно для
    закрытия конкретного пробела r1, а не переисполнения всего пакета.
11. Отдельный tooling finding — `spawnSync git ETIMEDOUT` на
    несвязанном #1062 unit — зафиксирован автором как отдельный issue
    [#1177](https://github.com/Matysh/houseplan-card/issues/1177), с
    сохранённым первым логом/хешем, без правки guard/таймаута и без
    сокрытия. Прочитан hand-off текст и development-notes раздел «CODE
    r1 M1 correction»: описание совпадает с кодом и тестами — не
    принято как готовое заключение, а перепроверено по п. 1-9 выше.

## Закрытие раунда r1

| Находка (r1) | Чем закрыта | Где это видно |
| --- | --- | --- |
| M1 — face/side для не-gate проёмов ошибочно использует индексированную грань, когда индекс построен ради gate в безстенном пространстве | `staticOpeningFace(opening, index, hasWalls)` проверяет `hasWalls \|\| opening.type==='gate'` **на каждый проём**, воспроизводя `_openingFace`/условие полного плана по месту вызова, а не один раз на пространство | `src/space-render.ts` (функция `staticOpeningFace`, строки, замещающие прежнюю `visibleSpec`-ветку); новый прямой unit `test/static-wall-openings.test.mjs` («#1171 M1: …»), исполнен в этом раунде — exit 0, PASS; новый Golden-сценарий `static-wall-openings-line-plan-phone-light` (`demo/fixtures/static-wall-openings.mjs` опция `linePlan`, `demo/golden/static-wall-openings.mjs` ветка `linePlan`); зарегистрированный mutation guard `static-gate-leaks-indexed-face-to-line-openings-1171`, нацеленный ровно на убранное условие |

## Унаследовано из r1 (без повторной проверки)

Следующее принято без повторного исполнения — вход/среда/oracle не
менялись после r1, диффом M1 не затронуты, подтверждающие прогоны
переиспользуются с точного материала `867202341` (validate-gate
https://github.com/Matysh/houseplan-card/actions/runs/41225580855):

- **AC1 (симптом/полнота).** Единый `projectedOpenings = geometryOpenings(...)`
  вместо `resolvedHosted`/`hostedOpeningSymbols`, ограниченных
  `host.kind==='partition'`. Документ: `CODE-REVIEW-1171-r1.md`,
  раздел «Что проверено и корректно», п. 1; материал r1 `a712b39b1`.
- **§7.2 — удаление заменённого пути.** `staticPassageOpenings` и её
  устаревшие тесты удалены без остатка дублирующего кода. Документ:
  там же, п. 3; материал r1 `a712b39b1` (неизменно в r2 — файл
  `src/space-geometry.ts` не тронут коммитами M1).
- **AC3 (контакт/состояние).** `renderOpeningEntityAvailable` определяет
  `available` до `amount`/`active`; устраняет отдельный missing-contact
  дефект (коммит `7dfb2d024`, не тронут M1). Документ: там же, п. 4.
- **AC4 (кадр).** `openingBounds` строится из той же `visibleSpec`,
  что и символы, один раз попадает в content/house frame. Документ:
  там же, п. 5; примечание — в r2 `visibleSpec` дополнительно получила
  параметр `hasWalls` через `staticOpeningFace`, но путь построения
  bounds (`openingVisibleBounds(visibleSpec(opening, 0), …)`) не
  изменился, только корректность самой грани внутри, что и было целью
  M1 — независимо перепроверено в этом раунде (см. «Как проверялось»,
  п. 3).
- **AC5/AC6 (кэш/стоимость).** `wallGeometryFingerprint` из
  `structureFingerprint + extras + roomOpenings`; `cachedStaticOpeningIndex`
  зеркалит `cachedStaticWallGeometry`. Документ: там же, п. 6; материал
  r1, не тронут M1 (вызов `cachedStaticOpeningIndex` в M1 не менялся —
  менялось только то, как его результат применяется в `staticOpeningFace`).
- **Пассивность.** Ни один путь не пишет `cfg`/`host`/`id`; snapshot
  до/после рендера и touch/click без service-вызовов. Документ: там
  же, п. «Пассивность»; не затронуто M1 (M1 — чисто read-side выбор
  грани, новый unit явно проверяет `JSON.stringify(cfg) === before`).
- **Документация/release-ledger (AC7, базовая часть).** USER-GUIDE
  RU/EN и CHANGELOG RU/EN за r1, `release-ledger stable-fix`.
  Документ: там же, п. «Документация/release-ledger». В r2 добавлено
  по одному предложению в CHANGELOG RU/EN и 4-й golden-intent — это
  дополнение, а не замена; проверено заново в этом раунде (см. «Как
  проверялось», п. 9).
- **Производные инвентари.** `ci-profile-paths.json`,
  `ci-registry-inventory.json`, `scripts/smoke-links.mjs`,
  `845-wall-corpus-identities.json` — штатные обновления без
  ослабления. Документ: там же, п. «Производные инвентари»; в r2
  затронут только `scripts/mutation-registry.mjs` (один новый guard —
  см. «Как проверялось», п. 7), остальные инвентари не менялись M1.

## Находки

Нет. Medium из r1 закрыт исправлением, подтверждённым независимым
построчным сравнением с полным планом и исполненным unit-тестом на
точном материале. Новых High/Medium в ходе независимого разбора M1-
диффа, сопутствующего `openingWallIndex`/`openCuts` вызова, Golden/
mutation-регистраций и документации не найдено.

## Что проверено и корректно

- Per-opening выбор грани (`staticOpeningFace`) математически и
  структурно идентичен `_openingFace`/условию `_renderOpenings`
  полного плана для всех трёх веток (partition / gate-или-walls /
  классика) — независимо прослежено по актуальному
  `src/houseplan-card.ts`, не только по хендоффу.
- `openingWallIndex(…, zeroWalls.contour, …)` — не самостоятельная
  копия алгоритма: `zeroWalls.contour` тождественен `_openCuts()`
  полного плана в путях без интерактивного инструмента.
- Один `visibleSpec`/`staticOpeningFace` обслуживает и символ, и
  bounds (frame) — единый pure seam, соответствует формулировке ТЗ
  «Использовать общую математику стороны/грани» и требованию
  «не дублировать независимую копию».
- Новый unit-тест — не формальность: он независимо вычисляет
  индексную грань и явно утверждает её отличие от классической перед
  тем, как проверить, что `staticOpeningFace` её не вернула для
  обычных проёмов — это делает тест способным упасть на доказанном
  пред-фикс поведении, а не только на гипотетическом.
- Mutation-guard `static-gate-leaks-indexed-face-to-line-openings-1171`
  нацелен точно на убранное условие и использует именно M1-тест как
  guard — зарегистрирован, не исполнен (соответствует AC6/nightly).
- Golden-сценарий `static-wall-openings-line-plan-phone-light`
  добавляет нативное (браузерное) покрытие того же случая поверх
  чистого unit, с иной numeric-проверкой masonry-точки для `linePlan`.
- Документация и release-ledger корректно и без избыточности отражают
  факт исправления; никаких обещаний нового поведения вне ТЗ.

## Чего не проверял / границы

- Не переисполнял весь пакет (build/typecheck/bundle:sync, остальные
  123 unit из 124, native smoke целиком, Golden-сцены в браузере,
  `gate:small`) — зафиксированы зелёными на точном материале `867202341`
  (https://github.com/Matysh/houseplan-card/actions/runs/41225580855) и
  не инвалидированы M1-диффом (вход/среда/oracle не менялись для них).
  Исполнил адресно только `build:test` + `unit:test/static-wall-
  openings.test.mjs`, закрывающие конкретный пробел r1.
- Не запускал Golden/Chromium для нового `linePlan`-сценария повторно —
  он уже покрыт зелёным validate-gate на точном SHA; независимая
  проверка выполнена чтением логики ветки, не повторным browser-
  прогоном (нет изменённого входа/среды/oracle, требующего
  переисполнения по политике этапа).
- Mutation execution (5 определений, включая новое M1-нацеленное) —
  по AC6 принадлежит nightly; подтверждена только статическая
  регистрация/корректность патча, не фактический «caught».
- Не проверял live HA / физический touch-девайс — не требуется по ТЗ
  (post-task E2E «не надо», не изменилось в r2: M1 — чисто read-side).
- Не проверял отдельный tooling finding #1177 (`ETIMEDOUT`) — это
  отдельный зарегистрированный issue вне скоупа #1171, не блокирует
  этот раунд.

## Гейты

**Прогнано в этом раунде:** `read:diff` (полный дифф материала против
общего предка `33707db7a`) — exitCode 0, `materialUnchanged: true`;
`read:log` — exitCode 0, `materialUnchanged: true`; `build:test` —
exitCode 0; `unit:test/static-wall-openings.test.mjs` — exitCode 0,
4/4 PASS (адресно для закрытия M1, конкретного Medium-пробела r1).

**Не прогонялось повторно в этом раунде (переиспользовано как валидное
свидетельство на точном материале `867202341`, вход/среда/oracle не
менялись):** build/typecheck/bundle:sync, остальные 123 targeted unit
(`test/space-render-caches.test.mjs`, `test/space-card-fit.test.mjs`,
`test/opening-symbol-placement.test.mjs`, `test/partition-openings.
test.mjs`, `test/room-opening-host.test.mjs`, `test/golden-matrix.
test.mjs`, `test/source-fingerprint.test.mjs`, `test/space-geometry.
test.mjs`, `test/open-passage-contract.test.mjs`), native smoke 24/24
(`demo/smoke_static_wall_openings.mjs`, включая смешанный line-plan
сценарий), `demo/smoke_open_passage.mjs`, `demo/smoke_space_card_
identity.mjs`, 4 Golden-сцены `static-wall-openings-*` плюс 2 strict
full-plan control (0px/0ratio/0maxDelta), полный pre-push, process-gate
`--issues`. Все перечислены в хендоффе и подтверждены ссылками на
зелёные CI-прогоны точного SHA (https://github.com/Matysh/houseplan-card/actions/runs/41225580855,
…580811, …580796).

**Не прогонялось и не требуется:** полная nightly/beta-матрица,
исполнение mutation-определений (AC6 явно это не требует, включая
новое M1-нацеленное), live HA E2E (post-task E2E «не надо»).

**Адресный пробел, закрытый в этом раунде:** сценарий `walls.length
=== 0` + `gate` + соседний не-gate wall-hosted проём (находка M1 из
r1) — ранее закрыт только чтением кода; в этом раунде закрыт
исправлением кода (`staticOpeningFace`) и подтверждён исполненным
unit-тестом (`unit:test/static-wall-openings.test.mjs`, PASS 4/4 на
точном материале `867202341`).

## Вердикт

High: 0. Medium: 0. r1-находка M1 закрыта исправлением, подтверждённым
независимым построчным сравнением с полным планом и адресным
исполненным unit-тестом на точном материале. Новых находок в ходе
независимого разбора диффа M1-раунда не выявлено.

Маршрут вердикта зафиксирован средой: `route: fix`. Поскольку High=0
и Medium=0, применимых условий для жёлтого вердикта (Medium в скоупе)
нет; вердикт — зелёный.

Побочных находок вне скоупа нет; политика `mode=issues` активна
(`outside_findings` пуст — побочных Medium вне скоупа не обнаружено).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjliOGRhMzBlYmI4Y2RmNzA4YjQxMjViZGNkMzA1YmVmODRiNjcwMzc4NTJmMGQ4NzcyNGIyZGI1NzljYzYxNDMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIzMGJjYzExZGRhMThiOGUzMjYxZmM1ODU0NWFmMTAwNGY1M2IyZDZlM2VhOTI4NmJiNzBkOWVjNTc0MzIwMDM2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTcxLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI4NjcyMDIzNDEyMDIzODRlMzI2NjYwODdiYjk1N2Y3YjE4YzEzMmI1IiwidHJlZSI6Ijc4ZmQ4NTMyZDY5NDc0NWNlNGYwNjNkYmY4MTllYTc5YWI2Mjk4YzEiLCJib2R5RGlnZXN0IjoiMjI2NzM5ZmRkMzBjNDliMTVmZmIwYmQ3NmE0ZGNlN2U3ZDM5NWM3ZTM4MTE0YzY2YTI0OGYwZDRjYWE0MzVmYSIsInByb2R1Y2VyUnVuIjoiNDEyMjY0Nzc0MTkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImZmMWYyYjljN2ExOTdhY2NlOGVmOTRhMjZhZTJjN2IwMWExOTkwODEwMzNhYjMzMjdiZGI5ZmM3N2MxOWVkOWIiLCJ2ZXJkaWN0RGlnZXN0IjoiZTMwZTdmMTNhZWRjNTY5ZTY1MGI0NmMyZDlmNWNjZWI5YTNhMTk4ZDdmYzA5Yjk2NzgyZjBkZmQ1OTBhNDgzYiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI0NjQyZjI3NzBmYzBhMGYyODMwMzEyYTM3MzRjMjJkNDM1MDdmODE0Y2M1ZTdiMjBhZmRlNDk2YzdkMTFkZTY2IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQ3MTEyMjkxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTcxI2lzc3VlY29tbWVudC02NTQ3MTEyMjkxIiwiYm9keURpZ2VzdCI6IjA1MjU1ODQwZjNhODMwOGI5ZTE3YmIzMDA4NzE4ODIxODJjZDE0MmMzNTM0MThlOTU1MTdmZmUzMjNhM2M3ZjkifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1171-static-wall-openings`, коммит `867202341202` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `78fd8532d694745ce4f063dbf819ea79ab6298c1`
  ```
  git log --all --format='%H %T' | grep 78fd8532d694
  ```
- Тело issue: `226739fdd30c49b15ffb0bd76a4dce7e7d395c7e38114c66a248f0d4caa435fa`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjIsIm91dHB1dF90b2tlbnMiOjI3NTA4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyNjM1MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI4ODg4MzUsImNvc3RVc2RFc3RpbWF0ZSI6MS4zNTgzNzA5OTk5OTk5OTk2fV0sInR1cm5zIjo0MSwiZHVyYXRpb25NcyI6Mzg1NTM0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zNTgzNzA5OTk5OTk5OTk2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=62 output_tokens=27508 cache_creation_input_tokens=126350 cache_read_input_tokens=2888835 num_turns=41 -->
