# SPEC-REVIEW-1093-r1

**Issue:** #1093 «Избирательная инвалидация frontend: быстрые операции,
скрытые потребители и временные гейты»
**Этап:** spec (PROCESS.md §2.4) · **Трек:** ask · **Заход:** r1 ·
блокирующих циклов израсходовано 0 из 4
**Материал:** тело issue #1093, `bodyDigest`
`44a197575e3a99cfcf61e3d2b4ece8cd3c05ccebbb8ae512dab187f474050900`
(REVIEW_CONTEXT, static-first snapshot), актуальные комментарии issue из
GitHub (включая механический preflight-отказ
issuecomment-6441609181 и его исправление issuecomment-6441648265, уже
отражённое в проверяемом теле), дерево репозитория
`65472755b03add1c39f216a27a700a2a568c7520` на коммите
`51fde59deaf24eebf823d9b5977edfea1315c38c` (рабочая копия на нём же;
`changedFiles: []` — class A/B файлы этим issue ещё не менялись,
реализации нет).

## Скоуп

ТЗ переносит инвалидацию общей frontend-цепочки config/layout/HA →
производные геометрия/контакты/presentation/summary с грубого «поменялся
config/эпоха» на зависимость от реально читаемых полей, владельца и спроса
активного потребителя — по всей цепочке (не только фон), включая скрытые
этажи/слои/панели, HA-обновления, #1073 Copy/Delete/Undo/Redo и обязательные
временные гейты простых операций. Обслуживает J1/J4/J6 из `docs/SCOPE.md`
(живой план, GUI-настройка, поддержание плана в актуальном состоянии).
Не-скоуп прямо исключает новый render engine/event bus, backend/protocol
rewrite, #1090 (LQI) и #1092 (SVG/drop-shadow) как отдельные задачи, а также
смену выбора света, collision safety, миграций и прав ради скорости.
Обязательные разделы §7.1 присутствуют со своими заголовками (проверено
построчно ниже) — механический preflight это уже подтвердил
(`specFormatErrors` → `format_ok=true`, `errors=[]` после исправления
issuecomment-6441648265).

## Как проверялось

Ревью этапа spec: осуществимость и однозначность ТЗ чтением материала и
адресных проверок кода/доков, без кодового Validate (REVIEWER.md «Объём
гейтов», §8). tsc/build/npm test/gate:small не запускались — не требуется
на spec, продуктовый код этим issue не менялся (#696); конкретного
непокрытого вопроса, который оправдывал бы запуск исполняемого check или
negative-input case, не возникло — все проверяемые утверждения закрылись
чтением.

| Проверка | Результат |
|---|---|
| Обязательные разделы §7.1 (сценарий · что увидит человек до/после · проблема · скоуп/не-скоуп · контракт поведения · UX · данные/миграция · i18n · AC1…AC11 с доказательством · план автотестов · риски · откат · release-артефакты) | присутствуют все под собственными заголовками (п.1/«Что человек увидит…»/п.2/п.3+«Не-скоуп»/п.4/п.10/«Модель данных и миграция»/«i18n»/п.8/п.9/п.11(риски+откат)/«Release-артефакты») |
| Однозначность и способ доказательства каждого AC1–AC11 | у каждого назван метод (unit/smoke/timing gate) и отрицательный/смежный вход (§8); AC10 прямо требует source-matched baseline RED/candidate GREEN на одном fixture — соответствует общей политике «чем краснеет» |
| Открытые продуктовые вопросы | не осталось: охват, обязательность ACK/невидимых потребителей и временных гейтов — прямые решения владельца в issuecomment-6441460187/6441460187-уточнении и зафиксированы дословно; технических вопросов, вынесенных владельцу, в теле не найдено |
| Адресная проверка центральной технической причины | `src/structural-space-record.ts:11` (`physicalSpaceRecord`) исключает только `decor` и `room.settings.sun_transparent`, остальные поля `space.settings`, включая `bg_mode`/`bg_color`/`title`/`name_color`/`wall_fill` и т.д., сохраняются в проекции — подтверждает заявленный дефект (эти визуальные поля меняют физический ключ) без необходимости что-либо исполнять |
| Существование заявленных модулей в скоупе | `Glob` подтвердил наличие всех 12 перечисленных файлов (`structural-space-record.ts`, `floor-geometry-key.ts`, `glow-scene.ts`, `houseplan-card.ts`, `houseplan-editor-runtime.ts`, `live-interaction-runtime.ts`, `render-snapshot-capture.ts`, `render-invalidation.ts`, `render-snapshot-reuse.ts`, `render-device-snapshot.ts`, `summary-panel-runtime-loaded.ts`, `view-runtime-boundary.ts`, `config-adoption.ts`) — архитектура не выдумана |
| Существование заявленного тестового фундамента (§9) | все названные smoke/benchmark файлы существуют: `smoke_space_settings(_form).mjs`, `smoke_floor_geometry_cache.mjs`, `smoke_floor_cache_reuse.mjs`, `smoke_render_invalidation.mjs`, `smoke_device_structure_history.mjs`, `smoke_device_copy.mjs`, `smoke_device_position_history.mjs`, `smoke_device_inbox_delete.mjs`, `demo/benchmark_device_copy.mjs`; `demo/performance/{evaluate,compare}.mjs` подтверждают, что инфраструктура для §7 timing gate уже есть и не требует «нового движка» |
| Релизная классификация (`v1.82.0`, stable-fix) | `package.json` → текущая версия `1.83.0-beta.2`, т.е. предыдущий stable действительно `1.82.0` — классификация корректна; `docs/release-ledger/v1.82.0/1093.json` отсутствует — ожидаемо на этапе spec (реализации нет) |
| Согласованность с canon подсистемы | `docs/SUN.md` подтверждает реальность и независимость `north_deg`/`sun_rays`/`sun_transparent` от фона (строка 121: «The background is independent of north_deg»), что совпадает с утверждением матрицы §5 («bg_mode не требует солнечной физики») |
| Согласованность с уже слитыми задачами | `docs/CHANGELOG.md` → «Unreleased» уже содержит #1090 (LQI) и #1073 (Copy/Delete/Undo/Redo), соответствует утверждению ТЗ «#1073 уже принят в dev и не переоткрывается» |
| Внутренняя арифметика лимитов §7 | p95-подпериоды складываются в заявленный итоговый p95 без противоречий (A: 100+100=200; B: 120+180=300); «клиентская задержка = сырое время минус только заданные fixture IO delays» снимает конфликт между фиксированной сетевой задержкой 320 мс и бюджетом ≤200/300 мс |
| Мутанты/отрицательные свидетели для защитных AC | неприменимо на этом этапе: реализации нет, временный патч исполняемого кода/сборки запрещён вне ночного workflow. ТЗ корректно откладывает заполнение финальной таблицы «AC · чем доказан · чем краснеет» на автора реализации (п.8, последний абзац) и уже называет метод и смежный/отрицательный вход для каждого AC — этого достаточно на этапе spec |

## Находки

Отсутствуют. Ни одной находки High или Medium (в скоупе или вне скоупа) по
итогам независимого чтения материала и адресных проверок.

## Что проверено и корректно

- **Техническая причина сформулирована и подтверждена чтением исходников, а
  не домыслена**: `physicalSpaceRecord` (`src/structural-space-record.ts`)
  действительно пропускает визуальные поля `space.settings`/`room.settings`
  (кроме `decor` и `sun_transparent`) в физический ключ, что подтверждает
  заявленную причину лишних `wallUnion`/`contact` пересборок на обычном
  сохранении цвета/фона/подписи.
- **Скоуп не ограничен одним bg_mode** — п.3 явно требует аудита всех входов
  цепочки (обычные writes, paired Copy/Delete/Undo/Redo, ACK/echo, внешний
  reload, HA state/registry, наследование, переходы floor/mode/visibility) и
  запрещает закрыть задачу одним исключением; матрица §5 даёт по каждому
  классу входа одновременно «что обновляется» и «что не должно
  пересчитываться», что делает критерий «лишняя работа» проверяемым, а не
  оценочным.
- **Контракт инвалидации (§4) непротиворечив**: ключ включает реальные
  зависимости (а не факт смены эпохи), активный потребитель определён через
  конкретные примеры (сводная площадь, читающая другой этаж; видимый маркер,
  зависящий от скрытой entity), сохранение надёжности записи/ACL явно не
  приносится в жертву скорости («нельзя откладывать надёжность записи или
  отзыв полномочий»).
- **Защита от регрессий для #1073 явная**: п.6 сохраняет operation_id, CAS/
  expected_rev, paired coherence, same-ID recovery и запрещает
  распространять ожидание structural ACK на уже оптимистичные Move/Resize/
  LED-шаги — технический конфликт с существующим контрактом не создаётся.
- **Временные гейты (§7) операционально заданы и не допускают маскировки**:
  вычитание только заранее известных fixture IO delays (а не фактического
  WS-ожидания), запрет подгонки под `delay=0`/`320`, запрет повторов до
  PASS, запрет уменьшения числа видимых устройств или поднятия лимитов ради
  зелёного результата, явный запрет называть сам факт сохранения JSON
  проверкой. Требование «минимум один временной A-кейс обязан дать RED на
  неизменной базе» воспроизводит уже измеренный в issuecomment-6441041060
  bottleneck (секундные long tasks 992/186 мс при нулевой сетевой задержке),
  то есть у AC10 уже есть демонстрированный на обычном (не мутантном) входе
  «чем краснеет».
- **AC1–AC11 проверяемы**: у каждого назван наблюдаемый результат и метод
  доказательства (unit/smoke/timing gate) плюс отрицательный или смежный
  вход (например, AC2 — «неизвестное поле и false/0/null/absent не
  схлопываются», AC3 — «safety guards не обходятся», AC9 — конкретная
  последовательность copy→move→delete→Undo×3→Redo×3).
- **Данные/миграция/i18n/откат/UX закрыты явным «нет нового»**: persisted
  config/layout/schema не меняются, новых UI/i18n-ключей нет, откат —
  обычный revert без потери данных, с явной оговоркой «не подавлять красный
  gate ради отката». Принятые предположения (shared typed helpers,
  consumer-demand stamps, пределы §7 относятся к pinned CI) явно помечены
  как таковые и оставлены на усмотрение ревью, а не выданы за факт.
- **Release-ledger классификация обоснована**: `stable-fix` относительно
  `v1.82.0` — потому что дефектный `floorGeometryKeyReader` уже был в stable
  (не introduced в текущей бете); проверка версии (`1.83.0-beta.2`)
  подтверждает, что `v1.82.0` действительно предыдущий stable.

## Чего не проверял

- tsc/build/npm test/gate:small/Chromium — не запускались: этап spec не
  требует кодового Validate, продуктовый код этим issue не менялся (#696).
- Фактические числа production-профилирования (265–343 мс серверных
  round-trip, 992/186 мс long tasks, 575–624 мс wallUnion) — не
  переисполнял сам диагностический стенд владельца; принял их как
  зафиксированное в issue основание, подтверждённое ссылками на точные
  строки кода на конкретном SHA `4c2ac36a` (строки проверены по факту
  существования, но не ре-профилированы).
- Полное содержимое `docs/WALL-THICKNESS.md`/`CANVAS.md`/
  `DEVICE-PRESENTATION.md` построчно — открыты адресно для конкретных
  терминов (`north_deg`/`sun_rays`/`sun_transparent`), не как полное
  построчное ревью; достаточно для подтверждения отсутствия противоречия
  матрице §5.
- Мутанты/отрицательные свидетели для защитных AC и финальная таблица
  «AC · чем доказан · чем краснеет» — неприменимо на этом этапе (реализации
  нет, исполнение мутанта вне ночного workflow запрещено); это требование
  код-ревью (REVIEWER.md «Код-ревью»), не spec.
- Внешний репозиторий `houseplan-e2e` и issue #1091 (план e2e-сценариев) —
  вне материала этого ревью, доверено авторской отсылке.
- Ручная dev/GPU-приёмка владельцем — добровольна (#929), не гейт этого
  ревью.

## Побочные находки

Побочных находок нет (`REVIEW_FINDINGS_POLICY`: `mode=issues`; типизированных
`outside_findings` не формируется — Medium вне скоупа не обнаружены).

## Вердикт

**Зелёный.** ТЗ выполнимо и однозначно: причина лишней работы заземлена в
реальном коде (`physicalSpaceRecord`/`floorGeometryKeyReader`), скоуп
покрывает всю цепочку (не один bg_mode), контракт инвалидации (§4) и
матрица аналогичных случаев (§5) делают критерий «лишняя работа» проверяемым,
совместимость с #1073 (ACK/CAS/history) сохранена явно, а временные гейты
(§7) операционально защищены от маскировки задержек и подгонки под PASS.
Каждый из AC1–AC11 называет наблюдаемый результат, метод доказательства и
отрицательный/смежный вход; открытых продуктовых или технических вопросов не
осталось. Маршрут: `fix` (трек `ask`; правило `reclassify` относится только
к код-ревью трека `show`).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjlkMTZiYzI0NzU2YzEwZjc1MzdiMTNjOWU2Y2Y1NDUxM2JlZTg4MGQyODA3ODE2N2YxMjhjYWY3Y2RmY2ZlNDgiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJkNDQxZjRiNjRjNDE2ZjRlNzliOTBhZDk4NTI3NzM4NzQ0NTE1MGQzODZiMDc3YmIzNmJiNGExNDdkYzQ2Y2EwIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDkzLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1MWZkZTU5ZGVhZjI0ZWViZjgyM2Q5YjU5NzdlZGZlYTEzMTVjMzhjIiwidHJlZSI6IjY1NDcyNzU1YjAzYWRkMWMzOWYyMTZhMjdhNzAwYTJhNTY4Yzc1MjAiLCJib2R5RGlnZXN0IjoiNDRhMTk3NTc1ZTNhOTljZmNmNjFlM2QyYjRlY2U4Y2QzYzA1Y2NlYmJiOGFlNTEyZGFiMTg3ZjQ3NDA1MDkwMCIsInByb2R1Y2VyUnVuIjoiNDA1MDI0ODg0OTUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImRhZmViOWYxNTYzNDdiYmJhNGFjZTE4N2Y2OGZlODM5YWExYTE0NWQzYjM4YzY3YmRmMWRjNTdiZTMwZWE1M2EiLCJ2ZXJkaWN0RGlnZXN0IjoiODAwMDExNDM1MmNkNjQyZWVkOWZlYTAxOTg3ZGIzYWU5MmI1ZTAxNzZjZjljMmM0NmVlZjE0ZWNmYzI3YWJhMSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI3NDc3NDYyMjBiYzMyNjYzNDk3YTA3OTQ1YWM2MjEyNmMxZjQyMGJkZDY2NmQyYzEwMDQ0ZDdjMWQ4NDU1ZWI1IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDQxODQzNDczLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDkzI2lzc3VlY29tbWVudC02NDQxODQzNDczIiwiYm9keURpZ2VzdCI6IjNkYWE1ZTE4MDkxYTllOGZkNjZjNjNhZDNhZDdjYWQ1ZDEwNTU1ZjMzNjUzYzA3Y2FkMTcyNmYzMzAzNDEzNzIifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `51fde59deaf2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `65472755b03add1c39f216a27a700a2a568c7520`
  ```
  git log --all --format='%H %T' | grep 65472755b03a
  ```
- Тело issue: `44a197575e3a99cfcf61e3d2b4ece8cd3c05ccebbb8ae512dab187f474050900`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjIsIm91dHB1dF90b2tlbnMiOjMyNzUwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwODUwMCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI1Nzk1NTEsImNvc3RVc2RFc3RpbWF0ZSI6MS4yNzc1MzQyfV0sInR1cm5zIjo0OCwiZHVyYXRpb25NcyI6NDM1ODk0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yNzc1MzQyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=62 output_tokens=32750 cache_creation_input_tokens=108500 cache_read_input_tokens=2579551 num_turns=48 -->
