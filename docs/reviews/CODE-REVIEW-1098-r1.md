# CODE-REVIEW — issue #1098, заход r1

Материал: `44d20c6f1b71d683593ab220d3a7f1bc4dc643da` (origin/dev..HEAD).
Коммиты: d1f245724, 93bc6c5df, dcc96f42c, ba27362a8, 44d20c6f1.

## Скоуп

Лестницы и вершина LED-полосы при drag теперь идут через существующий
live-rAF маршрут (`activeEditorGesture`/`scheduleHouseplanEditor`) вместо
полного Lit-рендера на каждый `pointermove`; `stairs`, `led_strips` и семь
полей размещения/прозрачности подложки (`plan_x`, `plan_y`, `plan_scale`,
`plan_scale_x`, `plan_scale_y`, `plan_angle`, `plan_opacity`) исключены из
проекции ключа для union/physical bodies/inner contours/light barriers/
contacts, но **не** из clean-floor ключа и не из `DemandSpaceModels`
(который теперь читает `stairs`/`bg` из сырой записи этажа, а не из
кэшированной полной модели — ловушка F‑SPEC‑1 из r1 ревью ТЗ).

Риск по изменённым участкам (#707), все три независимо проверены:
- geometry — `src/stairs-editor.ts:170` (`canonicalizeConfigGeometry` в `write()`);
- touch — `src/live-interaction-runtime.ts:123` (гейт HA-отложенных тиков
  теперь учитывает `stairs.dragging`/`_ledEditor.dragging`; фича
  desktop-first, touch-контракт не тронут — заявлено ТЗ и подтверждено
  чтением: правка внутри pointer-agnostic части рантайма);
- perf — `src/glow-scene.ts:254` (`lightGeometryFingerprint` расширен на
  все `PHYSICAL_PRESENTATION_FIELDS`, не только `led_strips`).

## Как проверялось

1. Независимый разбор кода: полный diff (`read:diff`), все изменённые
   src/test файлы прочитаны целиком (demand-space-models.ts,
   floor-geometry-key.ts, structural-space-record.ts, glow-scene.ts,
   stairs-editor.ts, led-strip-editor.ts, live-editor.ts,
   live-interaction-runtime.ts, houseplan-card.ts — релевантные участки,
   summary-panel-runtime-loaded.ts), прослежены вызывающие пути (`_model`
   → `_cfgPass`/`_cfgFingerprint` → `DemandSpaceModels.read` →
   `physicalFloorFingerprint`; `_floorKey`/`_cleanFloorKey` →
   `wallUnionKey`/`physicalBodiesKey`/`cleanFloorForRoom`;
   `resolveLightBarrierRevision` → `lightGeometryFingerprint`).
2. Сопоставление с авторским хендоффом и принятым CI (`ciEvidence`,
   validate-gate run 40711500752) — после независимого разбора, не вместо
   него.
3. Адресный запуск доступных деклараций (`build:test` +
   шесть `unit:*` для изменённых тестовых файлов) — реальное исполнение на
   точном материале, а не повтор чтения.
4. Сверка мутационного реестра (`scripts/mutation-registry.mjs`) — только
   регистрация/статическая проверка, мутант не исполнялся (запрещено вне
   ночного workflow).

## Что проверено и корректно

- **AC1/AC2 (live-кадр жеста).** `activeEditorGesture`
  (`src/live-editor.ts:118`) и `LiveRuntime.active()`
  (`src/live-interaction-runtime.ts:123`) учитывают
  `_editorRuntime.stairs.live`/`.dragging` и `_ledEditor.dragging`.
  `StairEditorRuntime.pointerMove` (`stairs-editor.ts:408-442`) больше не
  вызывает `replace()` на каждый кадр — только `drag.current`/`preview`,
  сырой `_curSpaceCfg.stairs` не трогается до `pointerUp`. LED (`handleMove`,
  `led-strip-editor.ts:699-712`) и раньше не писал в `strip.points` до
  `handleUp` — новое здесь только живой рендер через
  `editorTemplate`/`planTemplate` (`live-editor.ts:263-265,317-320`) вместо
  полного Lit-рендера. Подтверждено: `unit:test/stairs-editor-live.test.mjs`,
  `unit:test/led-strip-editor.test.mjs`, `unit:test/live-editor.test.mjs` —
  PASS на точном материале (см. «Гейты» ниже); реальный native-pointer
  прогон с подсчётом рендеров/`contacts.sync`/`_floorCacheBuilds.*` —
  `demo/smoke_stairs.mjs`/`demo/smoke_led_strip_draw.mjs`, зачтён из
  принятого CI (см. ниже).
- **AC3/AC9 (ключ по потребителю, значения после коммита).**
  `PHYSICAL_PRESENTATION_FIELDS` (`structural-space-record.ts:41-44`) —
  ровно девять полей из ТЗ, `plan_url`/`plan_aspect` и неизвестные поля не
  входят. `physicalFloorFingerprint` (`floor-geometry-key.ts:82-85`)
  проецирует их для union/bodies/contours/contacts/light barriers;
  `cleanFloorFingerprint` (`:88-92`) оставляет `stairs` значимым —
  используется `_cleanFloorKey` (`houseplan-card.ts:1983`) только в
  `cleanFloorForRoom` (`:9882`), а `_floorKey` (`:1984`) — в union/bodies/
  sun geometry (`:9204,9249,9858,10321`). Отдельная проверка по потребителю:
  `test/floor-geometry-key.test.mjs` — корпус из девяти presentation-полей
  (ключ/light-fingerprint не меняются) и десяти структурных/неизвестных
  полей (меняются) — PASS. `DemandSpaceModels` (`demand-space-models.ts:
  38-47`) больше не берёт `stairs`/`bg` из кэшированного `full()`: `stairs`
  — `stairList(raw.stairs)` (та же функция, что в `spaceModels`, т.1.91),
  `bg` — `raw.plan_url ? {href: raw.plan_url, ...planRect(raw, NORM_W)} :
  null` (та же формула, `href` сырой — это и раньше было так в `:38`
  старой версии, не новая несогласованность). Память на один `read` через
  `let stairs, bg` в замыкании `.map(raw ⇒ {...})`, пересоздаётся на
  каждый `read()`. Внешний `_modelCache` (`houseplan-card.ts:4229-4239`)
  всё равно инвалидируется на каждый `_cfgEpoch++` (ключ
  `epoch|_cfgFingerprint()`), а `_cfgFingerprint` намеренно удерживает
  `plan_x/y/scale*/angle/opacity` (`:4203-4213`) — так коммит подложки
  гарантированно даёт свежий `.read()` с полным набором актуальных `bg`/
  `stairs`. Подтверждено: `unit:test/demand-space-models.test.mjs` (пять
  presentation-патчей — `work.builds` не растёт, значения равны
  `spaceModels` по новой записи, пять структурных/неизвестных патчей —
  растёт; `bg === null` без `plan_url`), `unit:test/clean-floor.test.mjs`
  (новый тест: ACK площади комнаты через `DemandSpaceModels` равна
  независимому `spaceModels`-оракулу, `led_strips`/`plan_*`-патчи не
  меняют) — все PASS. `demo/smoke_floor_geometry_cache.mjs` добавляет
  прямую проверку значений (не только счётчиков): `<image data-hp="backdrop">`
  атрибуты и `_spaceModel().bg` равны независимой формуле `planRect`;
  площадь clean floor комнаты после переноса лестницы равна
  `window.__hp744.oracle` (независимый свежий рендер) и отличается от
  площади до переноса — зачтено из принятого CI (см. «Гейты»).
- **Ловушка «другой кэш» (явный риск ТЗ).** `summary-panel-runtime-loaded.ts`
  переведён с `physicalFloorFingerprint` на `cleanFloorFingerprint`
  (`:30,102`) — иначе тот же класс дефекта (устаревшее значение из
  суженного ключа) воспроизвёлся бы в `total_area`: эта правка не
  тривиальна и легко упускается. Подтверждено чтением (новый `git grep` по
  `_spaceModel`-владельцам кэша в `houseplan-card.ts` не находит других
  потребителей `physicalFloorFingerprint`/`cleanFloorFingerprint` кроме
  перечисленных) и задокументировано в `docs/CANVAS.md` («No model cache
  was narrowed beyond its consumer») — согласно собственному плану рисков
  ТЗ («другой кэш… — при коде проверить... и перечислить в описании
  коммита»), без отдельного автотеста для этого конкретного риска
  (решение ТЗ, не пробел ревью): существующий `test/summary-panel-
  area-memo.test.mjs` всегда подставляет свой `areaKeys` через тестовый
  шов (`floorRecordKeyMemo(contentFingerprint)` на строке 94), поэтому
  реальная связка `cleanFloorFingerprint` там не проходит боевую
  обвязку — но корректность самой функции `cleanFloorFingerprint`
  подтверждена отдельно (`floor-geometry-key.test.mjs`,
  `clean-floor.test.mjs`), а `floorRecordKeyMemo` — общий, независимо
  проверенный примитив; композиция верна по построению.
- **AC4 (структурные/неизвестные поля).** Тот же корпус
  `floor-geometry-key.test.mjs` проверяет `rooms`/`walls`/`wall_segments`/
  `partitions`/`wall_columns`/`openings`/`cell_cm`/`model_version`/
  `plan_url`/`plan_aspect`/неизвестное поле — ключ и light-fingerprint
  меняются. `#1093` контракт (display-настройки) не тронут — тот же
  `DISPLAY_SETTINGS`/`physicalRecord` без изменений.
  `test/demand-space-models.test.mjs` отдельно проверяет те же пять
  структурных/неизвестных входов на `DemandSpaceModels.work.builds`.
- **AC5 (отмена/отказ).** `endDrag(..., cancelled=true)` и
  `undoActiveDrag()` просто обнуляют `this.drag` — раньше явно откатывали
  (`replace(drag.original)`), что стало лишним, т.к. сырой конфиг никогда
  не менялся во время drag. `unit:test/stairs-editor-live.test.mjs`:
  «cancel и Escape не пишут и не бампают epoch» — PASS.
  `demo/smoke_geometry_history_refusal.mjs` не правился (как и требует
  план автотестов).
- **AC6 (глоу/свет).** `lightGeometryFingerprint` расширен на весь
  `PHYSICAL_PRESENTATION_FIELDS` (ранее — только `'led_strips'`); это
  безопасно, т.к. `stairs`/`plan_*` и раньше не питали физическую геометрию
  света (физические тела/union от них не зависят — то же самое
  обоснование, почему AC1 требует 0 сборок union при движении лестницы).
  Проверено корпусом в `floor-geometry-key.test.mjs` (light-fingerprint
  не меняется на presentation-полях, меняется на структурных).
  `smoke_led_strip_glow.mjs`/`smoke_led_strip_tube.mjs`/`benchmark_glow.mjs`
  не правились (по плану автотестов) — не являются предметом этого r1.
- **AC7 (бенчмарк).** `demo/benchmark_editor_gestures.mjs` (новый) меряет
  оба жеста на large-house, DPR1/2, 7 повторов; результаты в
  `docs/analysis/1098-editor-gestures-*.json`. Счётчики показывают 0 для
  union/bodies/contours/lightBarrier/contacts/epoch/full-render во время
  обоих 30-move окон во всех выборках; на коммите — ровно 1 рендер/sync/
  epoch, как и ожидается. Разовый всплеск `cleanFloor:+20` на первой
  выборке каждого DPR (а не на каждой) объясняется прогревом кэша внутри
  одного запуска страницы (сброс конфигурации между выборками возвращает
  уже виденное состояние) — это диагностика, не порог приёмки (AC7 прямо
  делегирует порог AC1–AC3, которые проверены отдельно изолированным
  одно-комнатным фикстуром в `smoke_floor_geometry_cache.mjs`, где
  build-delta строго `===1`).
- **AC8 (визуал).** `docs/release-ledger/v1.82.0/1098.json` объявляет 4
  golden-сцены (`stairs-flat-normal-light`, `stairs-flat-selected-light`,
  `led-strip-design-reference-on-light`, `wall-union-isolation-view-light`)
  с обоснованием по каждой. Зачтено из принятого `validate-gate`
  (run 40711500752): «review-light-golden proof is complete», артефакт
  содержит 4/4 strict unchanged Golden PASS (byte-identical, 0 differing
  pixels) на этом же SHA.
- **Порядок слоёв.** Новый placeholder `<g data-hp-live-stairs>`
  (`houseplan-card.ts:11536`) стоит ровно на месте старого вызова
  `stairs.renderLayer()`, **до** `_renderWallBodies(disp)` (`:11555`) —
  т.е. стены по-прежнему перекрывают лестницы в DOM-порядке. Подтверждено
  чтением обоих мест и проверяется смоком
  (`ac1098LiveStairsKeepTheirMasonryOrder`, зачтено из CI).
- **Канонизация (geometry-риск).** `write()` (`stairs-editor.ts:165-177`)
  теперь прогоняет `stairs` через `canonicalizeConfigGeometry` перед
  записью — та же функция и тот же набор полей (`x,y,length,width,radius,
  angle`), что уже используется для resize/decor/LED (`coordinate-
  canonicalization.ts:360-365`), минимальный синтетический конфиг
  `{spaces:[{stairs}]}` не задевает прочие поля. Подтверждено:
  `unit:test/stairs-editor-live.test.mjs` — «commit preserves future
  fields and uses existing persisted scalar precision» — PASS.
- **Release-артефакты.** CHANGELOG.md/CHANGELOG.ru.md — одна строка,
  согласованный текст, `#1098` в обоих. `docs/STATUS.md` — счётчик тестов
  5806→5815, ровно соответствует девяти добавленным `test(...)` блокам в
  диффе (1+1+1+1+2+3). `release-ledger` — `stable-fix` с обоснованием
  («lestnitsy #663 и LED #780 в stable»), рационал читает v1.82.0 source
  до классификации (подтверждено текстом рационале).

## Находки

Высоких и средних находок нет.

## Чего не проверял(ось) повторно / зачтено из существующего доказательства

- Полный браузерный smoke-набор (46/46, включая
  `smoke_stairs.mjs`/`smoke_led_strip_draw.mjs`/
  `smoke_floor_geometry_cache.mjs` в их актуальных версиях) и 4/4 strict
  unchanged Golden — зачтены из принятого `validate-gate`
  (https://github.com/Matysh/houseplan-card/actions/runs/40711500752) на
  точном материале `44d20c6f1`; входы/окружение/oracle с момента этого
  прогона не менялись (docs-only rebase до финального SHA не затрагивает
  исполняемый код задачи). Отдельно не перезапускал — нет конкретного
  непокрытого риска, который требовал бы нового прогона.
- `npm run gate:small`/общий `build:typecheck`/`build:build` — не
  запускал отдельно: это предрелизный гейт, не адресная проверка (§8);
  тот же код уже прошёл typecheck/build в составе принятого CI-рана.
- Мутант `presentation-key-retains-stale-demand-values-1098`
  (`scripts/mutation-registry.mjs`) — зарегистрирован и статически
  проверен (патчит `demand-space-models.ts` на чтение `stairs`/`bg` снова
  через `full()`); **не исполнялся** — исполнение мутанта вне ночного
  workflow запрещено политикой ревью.
- `benchmark_editor_gestures.mjs`/`benchmark_led_strips.mjs` — числа в
  `docs/analysis/1098-editor-gestures*.json` не пересчитывал заново
  (диагностика, не порог приёмки); счётчики внутри них использовал как
  дополнительное (не единственное) подтверждение AC1/AC2/AC3.

## Прогнанные гейты (этот заход)

- `read:diff`, `read:log` — PASS (материал подтверждён неизменным).
- `build:test` — PASS (подготовка test-build для юнитов).
- `unit:test/demand-space-models.test.mjs` — PASS.
- `unit:test/floor-geometry-key.test.mjs` — PASS.
- `unit:test/clean-floor.test.mjs` — PASS.
- `unit:test/live-editor.test.mjs` — PASS.
- `unit:test/led-strip-editor.test.mjs` — PASS.
- `unit:test/stairs-editor-live.test.mjs` — PASS.

Не прогонялись (и почему): полный browser-smoke набор и golden-набор —
зачтены из принятого `validate-gate` run 40711500752 на этом же SHA (см.
выше); `gate:small`/общий `build:typecheck`/`build:build` — предрелизный
гейт, не адресная проверка; мутационный прогон — запрещён политикой вне
ночного workflow, зачтена только регистрация.

## Вердикт

Green. Маршрут: fix (по директиве пакета #726). Побочных находок вне
скоупа нет.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImExNmVmY2I4ODllMDdjYmVkMDc5MmNlNzllNTNjMzI0YWYzMWMxZjNhMTlkYjM5N2QyNmRmODBjYWNhMDFjYTkiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3MDY3MjJlYjk4YzM4NzA5OTQyNGU5MTA1ZmMwZmViOTdkY2YyZDVkNzAxN2RmY2QzZWM4YzMwNTgxM2Y0MjZhIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk4LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI0NGQyMGM2ZjFiNzFkNjgzNTkzYWIyMjBkM2E3ZjFiYzRkYzY0M2RhIiwidHJlZSI6ImY5NmEzMmRjNThhNmZjODljNDdmZjAwZGYyZTQ1MTA4MDUzMzU2YWIiLCJib2R5RGlnZXN0IjoiZTQ0ZjRjMDMyZGM2NmE4YTVlYWM5ZjJjNDdmMjk5MTA5MWYwYTI4MjRmMWJlMzlmY2Y0OTNlMWExY2U3MzZlYyIsInByb2R1Y2VyUnVuIjoiNDA3MTUxOTc5NjkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjQ0NGVlMTExYjk3MzgwNGQ0NjcxN2RmMDkyZGQzNjY0ODI1OTEzNDEwZjQxNjM0ZDVhNzA4ODQwMmNjMWI3N2IiLCJ2ZXJkaWN0RGlnZXN0IjoiMTdmZDVlODExOWJhYmNkMDk3YzM4YzM0ZjQxZWUwYTVmZDJhOWIzZWQ0YmZkZGNiZjAxYTAwMjI1MDUyNmZlZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI5OTJmNjczY2JlYjE0MTFkZmY1ZTMyMTA1ZmUwODYxMTY4Nzc5NjBmNThiZjI1NzFhYTEyNmFiNzFiMDcyYTY0IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDczMzg0MDA5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk4I2lzc3VlY29tbWVudC02NDczMzg0MDA5IiwiYm9keURpZ2VzdCI6Ijk0Yzc2NTQ0MTc2ODFmOGE0NDg0OTIwZTM0MTQ3NGY0MjkyMzczODU3MWFmZDI5NGE0NjE2MWUyMmNiZTZlODUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1098-editor-gesture-demand`, коммит `44d20c6f1b71` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f96a32dc58a6fc89c47ff00df2e45108053356ab`
  ```
  git log --all --format='%H %T' | grep f96a32dc58a6
  ```
- Тело issue: `e44f4c032dc66a8a5eac9f2c47f2991091f0a2824f1be39fcf493e1a1ce736ec`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40715197969,"run_attempt":1,"digest":"8aad220b004d5a8486bddb3f09601ef09bfb8180b58f10ea7a3b6361bf7653d5"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTE0LCJvdXRwdXRfdG9rZW5zIjo1NjI0MywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMTg2MjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo4NjkwNjgxLCJjb3N0VXNkRXN0aW1hdGUiOjMuMTc1Mjc0MTk5OTk5OTk5Nn1dLCJ0dXJucyI6NjcsImR1cmF0aW9uTXMiOjc0MDk5MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuMTc1Mjc0MTk5OTk5OTk5NiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=114 output_tokens=56243 cache_creation_input_tokens=218620 cache_read_input_tokens=8690681 num_turns=67 -->
