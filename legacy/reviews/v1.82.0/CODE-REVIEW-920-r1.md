# CODE-REVIEW-920-r1

Материал: `18a009bc0a9b9894e50c6f52008e7aad14d825b7` (`git log --oneline origin/dev..HEAD`:
`28fb7616` feat, `f014d211` test, `c70b71e4` fix, `18a009bc` test/golden-accept).
Issue: #920, трек `ask`, этап `code`, заход r1, блокирующих циклов 0/4.
ТЗ: тело issue, редакция 1.2 (SPEC-REVIEW-920-r2, зелёный, digest
`d44972c4…`). Вердикт: **зелёный**. Маршрут: `fix`.

## Скоуп

Opt-in показатель CO₂ в карточке комнаты (основной план + киоск, Flat/2.5D),
подсказке комнаты и предпросмотрах; настройка видимости на уровне
пространства (`label_co2`) и выбор источника на уровне комнаты
(`co2_source`: Среднее / `entity:`/`device:`); backend schema/backup/support
projection/relay mirror; i18n (ru/en/de/fr, core + lazy settings). Статическая
`houseplan-space-card` намеренно не меняется (решение владельца 2026-10-17,
зафиксировано в ТЗ §13). Побочный рефакторинг: дедуп построения
`SpaceDialogState` между редактором, онбордингом и очередью импорта в новый
`src/editors/space-dialog-draft.ts`, и вынос нескольких существующих
room/preview строк из core в lazy `i18n/settings` — обе правки описаны и
обоснованы в ТЗ §10 (бюджет) и не выходят за его явную границу.

## Риск по изменённым участкам (#707) — сверка с AC

| Класс | Файлы | Покрытие AC |
|---|---|---|
| migration | `import_export.py:98`, `validation.py:1367/1430`, `types.ts:20` | AC6: новые optional-поля добавлены в `_SPACE_DISPLAY_FIELDS`/`ROOM_SCHEMA`/`SPACE_DISPLAY_SCHEMA`/`RoomCfg`, по тому же шаблону, что `temp_source`/`hum_source`/`label_hum`. Round-trip, projection, relay-зеркало и строгая типизация доказаны тестами (см. ниже) |
| perf | `iso-scene-render.ts:204/259`, `render-snapshot-capture.ts:140` | AC7 (footprint — константа `co2: 27` символов в существующем массиве `roomMetricTextCharacters`, без нового прохода) и AC8/#920 §5.1 (агрегатор остаётся одним проходом `roomClimateMap()`; `co2_source` добавлен в существующий `addSource()` снапшота, без новых подписок/таймеров) |
| ux (новые i18n-ключи) | `space.label_co2`, `roomcard.co2_label`, `room.co2_src_label`, обновлённый `room.group_sources.help` и т.д. во всех 4 языках, core + `i18n/settings` | AC1/AC5/AC7: ключи присутствуют и переведены (ru/en/de/fr); `test/i18n.test.mjs` явно разбирает совпадение EN/DE/FR для `space.label_co2`/`roomcard.co2_label` как обоснованный омограф (химическая формула/юникод), не как пропущенный перевод |

Все три класса имеют явную строку в ТЗ 1.2 (§5–§8) и автотест/native-smoke
доказательство — см. таблицу AC ниже. Понижения трека не требуется.

## Как проверялось

Материал прочитан целиком (`git diff origin/dev...HEAD`, 71 файл), включая
полный новый `src/room-co2.ts`, изменения `src/devices.ts`
(`roomClimateMap`/`sourceValue`/`co2For`/`co2DeviceValue`), все формы/драфты
(`room-settings-dialog.ts`, `room-save.ts`, `room-form-state.ts`,
`room-card-preview.ts`, `space-form.ts`, `space-dialog-draft.ts`,
`houseplan-editor-runtime.ts`, `houseplan-onboarding-runtime.ts`), рендер
(`houseplan-card.ts`, `live-hover.ts`, `iso-scene-render.ts`,
`render-snapshot-capture.ts`), backend (`validation.py`, `import_export.py`,
`support_*.py`, relay-зеркало и его тесты), i18n (все 4 языка, core + lazy),
golden (`harness.mjs`, `matrix.mjs`, 2 новых PNG, `golden-matrix.test.mjs`),
mutation registry и testing-notes, release-ledger, все затронутые доки.

Прослежена цепочка CI для материала `18a009bc`:

- `node scripts/classify-changes.mjs --heavy` — метка `ci:golden` диспатчит
  полный Validate (#827) до модели код-ревью: run
  [39073929782](https://github.com/Matysh/houseplan-card/actions/runs/39073929782),
  `event=workflow_dispatch`, `headSha=18a009bc…` — **success**: «Фронтенд:
  типы, юниты, мутанты, синхрон бандла», «Смоки в браузере» (все 3 шарда),
  «Golden-кадры против принятых эталонов», «Перф-смок» — все **success**.
  Это закрывает `tsc --noEmit`/`npm test`/`npm run build`+bundle-policy,
  смоки по диффу и golden одним прогоном на точном материале — повторно не
  гонял.
- «Бэкенд: pytest в Home Assistant» в этом прогоне **skipped** через
  content-addressed `reuse` (ключ по дереву backend-релевантных путей, не по
  ветке/SHA). Проверено по логам job `Переиспользование`: ключ
  `reuse-backend-108c6cd4…` восстановлен из `source_run=39072742515`,
  `source_sha=f7905b2f…` — это **тот же branch `issue/920-room-co2`**, где
  backend-релевантные файлы побайтово совпадают с материалом `18a009bc`
  (дерево `cf8eb467…`, то же, что в `localAttestation.source` нового golden
  baseline). В том прогоне job «Бэкенд: pytest в Home Assistant» выполнялась
  по-настоящему и завершилась **success** — не пустой skip, реальное
  исполнение HA pytest на идентичном дереву бэкенде. Таким образом backend
  pytest на материал подтверждён реальным CI-прогоном, а не только локальным
  отчётом автора (который дополнительно заявляет 1585 PASS/1 SKIP в WSL).
- `baselines-index.json.localAttestation` указывает на тот же коммит
  `f7905b2f…`/дерево `cf8eb467…`, `clean: true`; `sha256` в `Baseline-Reviewed-Local`
  трейлера коммита `18a009bc` (`513ee7b3…`) совпадает с
  `localAttestation.sha256` в файле — соответствие трейлера фактическому
  паспорту подтверждено.
- `node scripts/mutation-gate.mjs --check` — не гонял сам; статический
  `--check` не является caught по политике, и автор честно пишет
  `execution=0`. Три новых мутанта (`room-co2-loses-explicit-snapshot-source`,
  `room-co2-tooltip-keeps-old-state`, `room-co2-source-not-saved`)
  зарегистрированы в `scripts/mutation-registry.mjs` с `find`-патчем,
  привязанным к точной текущей строке кода (проверено построчно — совпадает
  с реальным кодом `render-snapshot-capture.ts`/`houseplan-card.ts`/`room-save.ts`
  на этом материале), и honest-labeled «не исполнялся» в AC-таблице
  — исполнение мутанта вне ночного workflow не производилось ни автором, ни
  мной.

**Что я не прогонял и почему:** `npx tsc --noEmit`, `npm test`, `npm run build`,
полный `npm run gate:small`, `golden:verify`, браузерные смоки и
`pytest tests_backend` — все эти гейты уже зафиксированы зелёными на точном
материале `18a009bc` реальным CI-прогоном (push+dispatch runs
`39073929782`/`39073194443`/`39072742515`, проверено по логам job, не по
слову автора), повторный прогон не добавляет доказательной силы и не входит
в объём ревью (PROCESS.md §8, «дешёвые гейты уже подтверждены»). Полные
performance/security-наборы не требуются по объёму задачи (PROCESS.md §8 —
«полные наборы — предрелизный гейт»).

## AC — разбор и доказательства

Для каждого AC отдельно проверено, что процитированный тест/smoke
действительно существует на материале и что защитные пункты дают явную
строку «чем краснеет»; ниже — независимая проверка, не пересказ handoff.

| AC | Проверено | Способ |
|---|---|---|
| AC1 (default-off, независимость, Flat/2.5D/View/kiosk/превью) | OK | `test/room-co2.test.mjs` (strict `=== true`), `demo/smoke_room_co2.mjs` (`defaultOff`, `tileDefaultOff`, `cancelDoesNotEnable`, `kioskAndStatic` — статическая карточка явно проверена на 0 `.rlmetrics/.rlm/.cpco2`), 2 golden-сцены (Flat light + Iso dark) с ассертом реального текста `850/1234 ppm` и 5-метрик-строки в `harness.mjs` |
| AC2 (автоматическое среднее, один физический голос, hidden/removed/local) | OK | `test/room-co2.test.mjs` (стабильный sibling-порядок, `co2DeviceValue` не кэширует устаревшее состояние — явный регресс-тест), `test/devices.test.mjs` (полный набор #317-регрессов расширен полем `co2: null`, старые векторы зелёные) |
| AC3 (явный источник, приоритет, нет скрытого fallback, сохранение/отмена) | OK | native `smoke_room_co2.mjs`: `onlyCo2Candidates` (CO/VOC/wrong-unit исключены из пикера), `roomDraftPreview`, `refusalKeepsDraft` (настоящий WS-отказ и повтор), `reopenedSource`; unit `sourceValue(... 'co2' ...)` с markers-жизненным циклом |
| AC4 (CO/VOC/AQI/неверная единица/пустое/NaN/Infinity/отрицательное/0) | OK | `test/room-co2.test.mjs` — исчерпывающий negative-input список (`''`, `' '`, `'unknown'`, `'unavailable'`, `'850 ppm'`, `'850garbage'`, `'NaN'`, `'Infinity'`, `'-1'`, `true`, `null`, посторонние `device_class`/`unit_of_measurement`) плюс положительные (`'0'`, `'850.49'`, `'8.5e2'`) — настоящий 0 проходит, прочее — null |
| AC5 (одно значение в карточке/подсказке/превью, обновление HA, stationary hover) | OK | `smoke_room_co2.mjs`: `tooltipSharesValue` → `sourceState` пушит `1487` БЕЗ движения мыши → `stationaryTooltipUpdates` (это прямое доказательство, что `updated()`-хук `this._tip.co2 = this._roomCo2(...)` реально работает, не просто зарегистрирован); `render-snapshot-incremental.test.mjs` — явный источник вне area остаётся в замороженном снапшоте |
| AC6 (schema/export/import/copy, support remap, будущие поля) | OK | `tests_backend/test_validation.py` (wrong-type negatives: `True/850/[]/{}` → `vol.Invalid`), `test_ha_import_export.py` (full+space backup round-trip, plan-only явно роняет `co2_source`, сохраняет `label_co2` — проверено по точному `assert room["settings"] == {...}` без `co2_source`), `test_support_config_projection.py` (псевдонимизация, raw id не попадает в JSON), `test_ha_support_v2.py` (read-ACL), `scripts/support-relay` — байт-в-байт зеркало + новые negative-кейсы в relay HTTP |
| AC7 (5 метрик/узкий экран/крупный шрифт/2.5D fit) | OK | `smoke_room_co2.mjs`: `previewNoHorizontalScroll` (820px, font 300%), `longFiveMetricRowFits` (20-значный CO₂, font 300%, реальный Fit-прямоугольник); `iso-scene-render.ts` footprint включает `co2` слот |
| AC8 (один проход, co2-only без зависимости от temp/hum, бюджеты) | OK | `test/room-co2.test.mjs` (`CO₂-only rooms and icons do not depend on temperature or humidity`); старые climate-векторы зелёные (`co2: null`); бюджетное исключение `LAZY_EDITOR_GZIP_CEILING: 269485 → 270411` — ровно согласованная владельцем (issuecomment-6241350905) и подтверждённая на SPEC r2 арифметика, перепроверена по `scripts/bundle-budget.mjs` — совпадает |

## Находки

Находок нет. Отдельно проверены и закрыты без находки три собственные
гипотезы о дефекте (детали — чтобы следующий раунд не тратил на них время
снова):

1. **WeakMap-кэш `co2DeviceValue` по `hass.entities`** — на первый взгляд
   похоже на риск устаревания при изменении реестра без смены ссылки
   объекта. Проверено: это тот же паттерн, что уже используется в
   `src/device-signal.ts` (`createDeviceSignalContext`, «Metadata index is
   built once per registry identity, never per hover/frame») — существующий,
   принятый в проекте инвариант о смене идентичности `hass.entities` при
   реальном изменении реестра, не новый риск этой задачи.
2. **`updated()`-хук мутирует `this._tip.co2` напрямую, в отличие от
   `temp`/`hum`, которые не обновляются вне `pointermove`** — асимметрия
   реальна, но это целевое усиление именно для CO₂ по явному требованию AC5
   («обновление HA… не оставляет чужое значение», доказано
   `stationaryTooltipUpdates` в native smoke), а не недосмотр: старое
   поведение temp/hum вне скоупа задачи и не регрессирует.
3. **Предпросмотр в диалоге комнаты при смене Area в том же сеансе до Save**
   — `_roomCo2(draftRoom, true)` берёт черновой `area` в ключ
   `roomClimateKey`, который совпадает с реальным ключом `_climate()` (карта
   строится по `area`/registry-target, а не по сохранённому состоянию формы),
   поэтому предпросмотр автоматического среднего для новой area фактически
   корректен, а не просто игнорирует черновик.

## Проверено и корректно (помимо AC-таблицы)

- Трейлеры: `Issue: #920` на всех 4 коммитах; `User-Visible: yes` только на
  `28fb7616`, и оба `docs/CHANGELOG*.md` правлены именно в нём. `18a009bc`
  несёт `Release:`/`Baseline-Reviewed-Local:` из-за правки
  `demo/golden/baselines/**`, паспорт сверен с `baselines-index.json`.
- Одно число — один источник: `269485→270411`/`926 B` повторяется в
  issue-комментарии владельца, ТЗ §10, `scripts/bundle-budget.mjs` и
  `docs/DEVELOPMENT.md` — везде одна и та же измеренная величина, не
  независимые пересчёты. `v1.82.0-beta.1` в `docs/STATUS.md` — существующий
  тег `dev` от 2026-10-17 10:45 (до начала этой задачи), не выдумка
  регенерации.
- `docs/release-ledger/v1.81.0/920.json`: `category: "major"` относительно
  предыдущего stable `v1.81.0` — обоснованно (новая пользовательская фича,
  не inside-beta фикс), `introducedBy` не требуется (не правка существующей
  бета-функции).
- i18n: `test/i18n.test.mjs` корректно учитывает EN/DE/FR-совпадения для
  `space.label_co2`/`roomcard.co2_label` как язык-нейтральные научные
  обозначения (FR отличается типографикой `CO₂ :` — не идентичен EN, что и
  подтверждает осознанный, а не формальный перевод).
- Два обновлённых smoke-оракула (`smoke_room_settings.mjs`) — заменили
  зависимость от переведённой строки, уехавшей в lazy-словарь, на стабильные
  `data-card`/`name`-селекторы; это укрепление, не ослабление проверки, и
  прямое следствие рефакторинга этой же задачи, не посторонняя правка.
- Старые регрессы `test/devices.test.mjs` (#317, #44, #262, 369в) остались
  зелёными с добавленным `co2: null` — расширение интерфейса `AreaClimate`
  не ломает прежний контракт.

## Чего не проверял

- Ручная GPU/визуальная приёмка владельцем — не обязательна (#929), не
  проверял и не требую.
- Полные performance/security отчёты, нагрузочные сценарии — вне объёма
  задачи и PROCESS.md §8 (предрелизный гейт).
- Публикация HACS beta/stable и деплой relay в production — автор прямо
  пишет «не сделано», решение владельца не запрашивалось и не требуется
  к этому ревью.
- Не пересобирал локально `tsc`/`test`/`build`/`golden:verify`/браузерные
  смоки/`pytest tests_backend` — зафиксированы зелёными на точном материале
  реальными CI-прогонами (см. «Как проверялось»); не нашёл оснований не
  доверять этой цепочке после проверки по логам job, а не только по тексту
  хендоффа.
- Мутанты реестра не исполнял (как и автор) — вне ночного workflow это
  запрещено политикой; статическая регистрация проверена построчным
  сопоставлением `find`-патчей с текущим кодом.

## Итог

Вердикт: зелёный. High: 0, Medium: 0. Маршрут: `fix` (не `show`, понижение/
reclassify не применяется). Бюджет циклов не тратится.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/920-room-co2`, коммит `18a009bc0a9b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `cb514fade1c91c0f1cd0fa219ca9aa60ddc28d2b`
  ```
  git log --all --format='%H %T' | grep cb514fade1c9
  ```
- Тело issue: `d44972c41d1717955eed006a390ea869c7960ca23816b6ebab3e52675412bac9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMjMsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjEzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNzQsIm91dHB1dF90b2tlbnMiOjU1MzIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIyMDY5OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEyODg5NjA1LCJjb3N0VXNkRXN0aW1hdGUiOjQuMDE0MjkxMDAwMDAwMDAxfV0sInR1cm5zIjo5MywiZHVyYXRpb25NcyI6Njg3MzkzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6NC4wMTk1MDQwMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5297 output_tokens=55341 cache_creation_input_tokens=220698 cache_read_input_tokens=12889605 num_turns=93 -->
