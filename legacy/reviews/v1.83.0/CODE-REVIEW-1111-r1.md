# CODE-REVIEW #1111 — заход r1

Материал: `7dd01ccbc58e0267044e9de7cc4a7650872990ac` (единственный коммит в диапазоне
`origin/dev..HEAD`: «Reuse HA state projections and acquire ripple lights on demand»).
Трек: `ask`. Маршрут: `fix` (задано пакетом ревью).

## Скоуп

Задача оптимизирует приём `hass` на видимом плане: инкрементальная активная
проекция реестра (`PlanHassProjection`, новый `src/plan-hass-projection.ts`) и
спрос-зависимый расчёт источников света для ripple (`_syncActivityRuntime`,
`src/houseplan-card.ts`). Затронутые классы риска по промпту — perf
(`src/houseplan-render-lifecycle.ts:111-115`, скрытый/ушедший маршрут приёма) —
покрыт AC3 («полная пересборка по событию… возврат из скрытого документа/
ушедшего маршрута») и AC7 («поведение #1093 без изменений»); разобран ниже.

## Как проверялось

Независимый разбор кода предшествовал чтению авторского хендоффа: прослежены
`PlanHassProjection.project`, `activeRegistryHass`/`registryStateEnabled`
(`src/ha-binding-status.ts`), `_planHass` getter, `intakeHass`
(`src/houseplan-render-lifecycle.ts`), `_syncActivityRuntime`/`_activityTick`.
Сопоставлены все 7 AC из ТЗ (issue body, раздел «Критерии приёмки») с кодом и
тестами по каждому пункту; прочитаны оба новых теста (`test/plan-hass-
projection.test.mjs`, `test/plan-hass-fixture.mjs`) и подтверждено, что
существующие `test/ha-binding-status.test.mjs` (не изменён) и
`demo/smoke_activity_color_settings.mjs` (точечно расширен) остаются валидным
независимым доказательством без переписывания под новую реализацию.

Выполненные проверки в эту сессию (через `run_check`, доверенный fixed-check
раннер):
- `read:diff` — полный `git diff origin/dev...HEAD`, построчно сверен с
  исходниками.
- `read:log` — подтверждён единственный коммит материала.

Не выполнялись повторно: `build:typecheck`/`build:test`/`unit:*`/`smoke:*` и
`gate:small` — для них есть пригодное, непротухшее доказательство: validate-gate
на точном SHA `7dd01ccb` зелёный (https://github.com/Matysh/houseplan-card/actions/runs/40677970564),
а хендофф называет конкретные команды и результаты (`node --test
test/plan-hass-projection.test.mjs test/ha-binding-status.test.mjs
test/houseplan-render-lifecycle.test.mjs test/activity-runtime.test.mjs` →
27/27; 8 целевых smoke из `scripts/smoke-links.mjs` → 8/8; `node scripts/process-
gate.mjs --range origin/dev..HEAD --issues` → PASS; `node scripts/mutation-
gate.mjs --check` → PASS, 4 новых декларации, honestly помечены «не
исполнялись»). Независимый разбор кода не выявил пробела, который требовал бы
адресного повторного прогона (отдельно см. «Чего не проверял» ниже); поэтому
tsc/build/smoke не перезапускались — это не «запасной сценарий», а решение,
принятое после того, как разбор не нашёл непокрытого риска.
Мутанты/ручные патчи исполняемой реализации не применялись (вне ночного
workflow это запрещено, #905); «чем краснеет» для защитных AC подтверждён
чтением тестов и 4 новых деклараций в `scripts/mutation-registry.mjs`
(`plan-hass1111Cases`), без их исполнения.

## Разбор по AC

- **AC1** (тик без спроса дёшев). `PlanHassProjection.project` сравнивает
  `hass.states[eid]` по ссылке с предыдущим кадром и зовёт
  `registryStateEnabled` только для отличающихся/удалённых ключей; при
  `source === previous.states` обе петли пропускаются целиком (0 обработок).
  Тест `test/plan-hass-fixture.mjs` считает обращения к `snapshot.entities`
  независимым Proxy (не переиспользуя функцию самой проекции) — пять изменённых
  строк дают `f.count() <= 5`, тик без изменений — `0`. «Чем краснеет»:
  зарегистрированный `plan-hass-rechecks-unchanged-rows-1111` (отключает
  проверку ссылочного равенства) — не исполнялся, что честно указано. Полный
  обход ключей `hass.states` (дешёвый `Object.keys`, без обращения к реестру)
  на каждый тик остаётся — это явно принятое в ТЗ предположение
  («Принято предположительно»), не дефект.
- **AC2** (та же проекция). `registryStateEnabled` вынесена из
  `activeRegistryHass` без изменения условий (disabled-сущность, disabled-
  родитель, отсутствие родителя при `authoritative`) — дифф это подтверждает
  построчно. Новый корпус-тест сравнивает инкремент с `activeRegistryHass`
  «с нуля» через 5 изменений (disabled, disabled-родитель, отсутствующий
  родитель+`authoritative`, YAML/`sun.sun`, добавление/удаление,
  `undefined`-значение, флип `authoritative`) и проверяет неизменность
  предыдущего кадра. Поскольку обе стороны сравнения используют одну и ту же
  `registryStateEnabled`, этот тест сам по себе не ловит регрессию *в самой*
  disabled/authoritative-логике — но она независимо защищена неизменными
  `test/ha-binding-status.test.mjs` (hardcoded-ожидания по ключам, не через
  сравнение с собой), которые не входят в changedFiles и, по хендоффу,
  прошли 27/27 вместе с новыми. Разрыва в покрытии нет.
- **AC3** (полный проход по событию). Единый тест проходит по пяти событиям
  (ревизия реестра, `connection`, `user`, скрытый документ → видимый,
  `_routeDepartureHandled` → `false`) и после каждого ждёт ровно +1
  `fullBuilds`, затем 3 тика без изменений — без прироста. Прочитан
  `intakeHass`: `host._planHassProjection?.invalidate()` плюс сброс
  `_planHassMemo.hass` вызываются именно в ветке
  `hidden || routeDepartureHandled` (`src/houseplan-render-lifecycle.ts:111-115`),
  до какого-либо обращения к `_activityTick`/`_vacTick`/`_maybeRebuildDevices` —
  порядок приёма (`_ensureHaRegistryAuthority`, `_hookConnection`,
  `_alerts.reconcile`) не переставлен. «Чем краснеет» для user/hidden-веток —
  зарегистрированные `plan-hass-forgets-user-owner-1111`,
  `plan-hass-reuses-hidden-projection-1111` (не исполнялись); для
  registry/connection веток — сам unit-тест читаемо падает при поломке
  соответствующего сравнения (подтверждено чтением, не исполнением мутанта).
- **AC4** (ripple по спросу). `_syncActivityRuntime` считает `hasDemand` по
  текущему `_space` до вызова `resolvedLightSources`; фильтр `hasDemand`
  буквально совпадает с фильтром цикла по `_displayDevices` ниже — поэтому
  `planLightSources === undefined` никогда не используется там, где он
  реально нужен. Новый тест проверяет: нет устройств → 0 обращений к
  `_planHass`; устройство на другом этаже/скрытое → 0; единственное видимое
  ripple-устройство → 1, повторный тик без изменения входов не трогает
  `lightWork` (кеш переиспользован); уход на другой этаж — `_activityRt`
  теряет запись. Браузерный кейс добавлен в `smoke_activity_color_settings.mjs`
  (перенос маркера в HA-привязанную комнату другого пространства) — проверяет
  то же на реальном DOM/HA-цикле.
- **AC5** (прежние потребители тика). Файлы потребителей (`smoke_device_
  battery_performance.mjs`, `smoke_radar_live.mjs`, `smoke_vacuum.mjs`,
  `smoke_live_text.mjs`, `smoke_selective_invalidation.mjs`) не изменены;
  новая запись в `scripts/smoke-links.mjs` привязывает их к
  `src/plan-hass-projection.ts`. `_vacTick`/`_maybeRebuildDevices` не
  затронуты диффом.
- **AC6** (бенчмарк). `demo/benchmark_hass_tick.mjs` — новый, изолированный
  (Node-процесс, без браузера), измеряет `unchanged`/`five-changes`/
  `registry-change`, 20×3 замера, до/после сохранены с хешами исходников и
  фикстуры в `docs/analysis/1111-hass-tick-{before,after}.json`. Цифры
  согласованы: `registryLookups` 1673→0 (unchanged), 1673→5 (five-changes),
  `lightRequests` 1→0 во всех трёх группах — ровно то расточительство, которое
  описывает проблема issue. Честно указано, что `registry-change` p95 вырос
  (3.72→4.12мс, пояснено одним общим `Object.keys`-сканом вместо точечных
  обращений) — это не нормативный порог AC, и автор прямо это не скрывает.
- **AC7** (скрытый/ушедший маршрут, гейты). Порядок операций в `intakeHass`
  не переставлен относительно #1093 — новые 3 строки добавлены строго внутри
  уже существующей ветки раннего возврата. `test/view-runtime-boundary.test.mjs`
  и `smoke_view_runtime_kiosk_recovery.mjs` не изменены (чистый consumer-proof).

## Находки

Нет находок High или Medium.

Низкая (не блокирует, снимается ревьюером): `PlanHassProjection.counters.
processed`/`.comparisons` (`src/plan-hass-projection.ts:18,39,46,49,56`)
заведены как seam «для тестов и бенчмарка» (так в скоупе ТЗ), но ни один тест
и ни бенчмарк их не читают — `test/plan-hass-projection.test.mjs` и
`demo/benchmark_hass_tick.mjs` меряют то же самое количество независимым
способом (Proxy на `snapshot.entities`, разница `f.reads()`). Сам seam,
который требовало ТЗ («число обработанных состояний на тик»), таким образом
наблюдаем и проверен — просто не через эти поля. Поле `counters.fullBuilds`
используется, `processed`/`comparisons` — нет: это задел без потребителя,
который может незаметно разойтись с реальной стоимостью при будущей правке
(никто не узнает). Последствие ограничено внутренней диагностикой, не влияет
ни на один AC и не видно пользователю — Low, правка не требуется в этом цикле.

## Release-артефакты

`docs/release-ledger/v1.82.0/1111.json`: `stable-fix`, обоснование — оптимизация
существующего (уже в v1.82.0) пути приёма/ripple без смены протокола,
персистентных данных или видимого результата; правдоподобно (код относится к
давно существующим `activeRegistryHass`/`_syncActivityRuntime`, не к новой
бета-функции) и является авторским суждением, независимо не пересчитывалось.
Оба CHANGELOG (RU/EN) правлены одной строкой с `#1111` в этом же коммите;
`User-Visible: yes` — соответствует. `docs/STATUS.md` Tests-счётчик 5780→5786
совпадает с 6 новыми тестами в `test/plan-hass-projection.test.mjs` — одно
число, один источник (генератор `status-snapshot.mjs`). `docs/ARCHITECTURE.md`
и `docs/DEVELOPMENT.md` описывают именно то, что добавлено в код (сверено
построчно с диффом). i18n/USER-GUIDE не затронуты — new UI/строк нет, что
верно для чисто внутренней оптимизации.

## Что проверено и корректно

- Полный `git diff` построчно сопоставлен с описанием: `plan-hass-projection.ts`
  (новый), извлечение `registryStateEnabled` в `ha-binding-status.ts` без
  изменения условий, `_planHass`-геттер, спрос-гейт в `_syncActivityRuntime`,
  инвалидация в `intakeHass`, `connectedCallback`/`disconnectedCallback`.
- Порядок приёма тика (`_hassSequence`, `_continuity.note`,
  `_ensureHaRegistryAuthority`, `_hookConnection`, `_alerts.reconcile`,
  `_maybeRebuildDevices`, `_vacTick`, `_activityTick`) не переставлен.
- Разобрана гипотеза «проекция недоинвалидируется» (риск из ТЗ) — покрыта
  корпус-тестом AC2 и границами AC3; гипотеза «скрытый потребитель света кроме
  ripple» — единственный вызов `resolvedLightSources` в `_syncActivityRuntime`
  гейтится тем же предикатом, что и единственный цикл-потребитель ниже, второго
  места вызова в затронутом коде нет.
- Мутационные декларации (4 новых, `scripts/mutation-registry.mjs`) синтаксически
  корректны (строки `find` совпадают с текущим кодом один-в-один), honestly
  помечены «не исполнялись» — не заявлены как caught.
- `scripts/ci-registry-inventory.json`, `scripts/monolith-baseline.json`
  (`hostRefs` 6529→6532, `bundleBytes` 3649075→3651091) согласованы с текстом
  `docs/DEVELOPMENT.md` и ранее одобренным владельцем расширением полосы.

## Чего не проверял

- Не перезапускал `gate:small`, `unit:*`, `smoke:*`, `build:*` и
  `mutation-gate.mjs --check` — переиспользовано зелёное доказательство на том
  же SHA (validate-gate run 40677970564); конкретного непокрытого AC/риска,
  требующего адресного перезапуска, не нашёл.
- Не выполнял мутанты (временный патч исполняемой реализации) — запрещено вне
  ночного workflow; «чем краснеет» подтверждён чтением объявлений и логики, не
  исполнением.
- Не проверял полную ночную матрицу/release-гейты (golden, HA-harness,
  полный regression) — не входит в объём код-ревью задачи (§8, «Объём гейтов
  соразмерен задаче»).
- Не проверял независимо авторскую классификацию `stable-fix` против
  фактического содержимого тега `v1.82.0` (не читал diff самого тега) — принял
  как авторское суждение согласно REVIEWER.md.

Маршрут: `fix`.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImRjZmJiZjQ5ZTBjY2VlZWRiNDY2MGFlMWE4MGFiMmE4NzdhOGQyZTk0MzA5Njk3Njk3OTljNzBkMGRlNDc4NzUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3MGVlZTBkZTY5N2RjYmUzODEzMzExMDVlNmM5NTFiNmVkMThiYmMxNGYxOWUxYTg4NzM4MDczNjk3OGNkODVkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTExLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI3ZGQwMWNjYmM1OGUwMjY3MDQ0ZTlkZTdjYzRhNzY1MDg3Mjk5MGFjIiwidHJlZSI6IjRiOGFhYmIzNzlhZGIxMDFkMzA4YTc3MjFhZGRlYTZmMTI5MDliMGMiLCJib2R5RGlnZXN0IjoiYTNlYWI2N2Y2MTQ4MjlmMmI2ZDBkNTQ1NjMxZWE0ZjM1N2IwMWE2NTM3MDQ4YjdlODM3ODI0NTQxYTA5M2QxZCIsInByb2R1Y2VyUnVuIjoiNDA2NzkyODEwNzUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjA2ZDE0YmEyOWI1NTM2OGM1YzkxZjFmMDIwMDMyMWFlNzg4NzhmYjEwMzIwZjk3OTU3MTk1OWE2OWI1MmQ2ZTAiLCJ2ZXJkaWN0RGlnZXN0IjoiY2RjMDAzNTg3YmRmNzdhMzZlZWUzN2ZlYWRhNDljNGM4OTE3YThhMmIxMGE4YmQwMTBlYTVmZjU2NTNhMmUzNCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI2MGI1Mzc4NmRjMWM3ZWI2MWYxMGExNmZhMDY3NGI5M2U2MjlkNWM3YzlmZDJhNTMyNWQzZGRjMTE5YzY4MjYxIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDY3OTY4NjUxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTExI2lzc3VlY29tbWVudC02NDY3OTY4NjUxIiwiYm9keURpZ2VzdCI6IjIzNjBiM2JmNjU1MmFiMDc0YzRiM2EwYzhkODQyZmE0YzEzNmQ3ODk5ZTEwZDU5NTUxZjVkZTIyMTQwMzAyZmQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1111-plan-hass-projection`, коммит `7dd01ccbc58e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4b8aabb379adb101d308a7721addea6f12909b0c`
  ```
  git log --all --format='%H %T' | grep 4b8aabb379ad
  ```
- Тело issue: `a3eab67f614829f2b6d0d545631ea4f357b01a6537048b7e837824541a093d1d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40679281075,"run_attempt":1,"digest":"a3567e7181851cb68ba0fdccfa805e4e27b10e57ceca8bc28cafd3450c61725b"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjYsIm91dHB1dF90b2tlbnMiOjUwMTc2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIwNDg4NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ1MDE1NDksImNvc3RVc2RFc3RpbWF0ZSI6Mi4yMjE3NDk4fV0sInR1cm5zIjo0MCwiZHVyYXRpb25NcyI6NTczMDYyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4yMjE3NDk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=66 output_tokens=50176 cache_creation_input_tokens=204887 cache_read_input_tokens=4501549 num_turns=40 -->
