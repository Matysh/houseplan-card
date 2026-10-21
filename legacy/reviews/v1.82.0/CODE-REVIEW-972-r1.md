# CODE-REVIEW-972-r1

Материал: `c9fbad4970104a40556fd377473680174e2016b9` (`issue/972-device-issue-reasons`,
база `dev` `77d763f2607b2316a33f77c963889f1245720c5e`, включая #973).
Диапазон: `git diff origin/dev...HEAD`, 41 файл. Трек `ask`, заход r1,
блокирующих циклов 0/4. SPEC-REVIEW-972-r1 — зелёный, без находок.

## Скоуп

Закрывает J1/J2/J3 (SCOPE.md): подтверждённые сервисные напоминания Home
Connect Local (`machinecarereminder` / `machinecareandfiltercleaningreminder` /
`smartfiltercleaningreminder`, platform `homeconnect_ws`) больше не красят
маркер красной тревогой — пассивный жёлтый знак на плане плюс общий список
текущих причин (alarm/maintenance) в уже существующей карточке устройства и в
`hp-device-preview`. Настоящие аварии (hazard-классы, siren, triggered panel,
неизвестный `problem`) сохраняют красный приоритет без изменений.

## Как проверялось

Дешёвые гейты подтверждены независимым зелёным Validate на этом самом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/39402793285) — `tsc`,
`npm test`, `npm run build`, backend/HA parity, процессный preflight. Не
перегонял их повторно.

Я сам прогнал (чисто, в этой сессии, на том же `c9fbad497`):

| Гейт | Команда | Результат |
|---|---|---|
| Сборка для смока/golden | `npm run build` + `node scripts/bundle-sync.mjs` | OK (нужно было для локального запуска смока/golden; бандл восстановлен `npm run bundle:clean` после, рабочее дерево чистое) |
| Unit AC1–AC6 | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/device-issues.test.mjs` | **6/6 PASS** |
| Целевой browser smoke (AC4/5/6) | `node demo/smoke_device_issue_reasons.mjs` | **PASS** (headless-shell 151.0.7922.34, тот же pin, что в индексе golden) |
| 4 новых golden-кадра (диагностический `--scenario=`, не полный verify) | `node demo/golden/run.mjs --mode=capture --scenario=device-issues-{maintenance,alarm}-{plan,card}` ×4 | Все 4: **passed, diff=0px, ratio=0.000000**, sha256 совпал с `baselines-index.json` (визуально проверил все 4 PNG — alarm побеждает на плане, maintenance даёт пассивный ключ без пульсации, карточка показывает обе группы при совпадении) |

Чего не проверял и почему: полный `golden:verify` (216 сцен) и полный
`smoke-select` — предрелизный гейт по §8, не гейт этого ревью; AC4 смок и
4 новых кадра точечно покрывают риск диффа. `pytest tests_backend` — в диффе
нет Python/`custom_components`. `npm run invariants` — диффа геометрии/wall
model нет (затронутые модули — `device-presentation.ts`/`device-issues.ts`/
UI, не геометрия). Полная аттестованная WSL golden-съёмка и CI HA-harness —
уже в материале хендоффа и в зелёном Validate, повторно не гонял. Мутанты
(`device-maintenance-promoted-to-alarm-972`,
`device-issue-warning-intercepts-pointer-972`,
`device-issue-opens-wrong-source-972`) — только проверил регистрацию
(`scripts/mutation-registry.mjs`, `docs/testing-notes/mutation-browser-guards.md`
с обновлёнными счётчиками 429/200, 63 и 88 по категориям), не исполнял —
исполнение вне ночного workflow запрещено.

## Разбор по AC (чтением + исполнением)

- **AC1** — `src/device-issues.ts:classifyDeviceIssue` понижает только
  `binary_sensor` + `device_class=problem` + `platform=homeconnect_ws` +
  точный `translation_key` из трёх, либо (без ключа) точный `unique_id`
  suffix `-<key>`. `off/unknown/unavailable` возвращают `null` раньше по
  `isAlarmState` (переиспользован из `logic.ts`, не переопределён). Доказано
  исполнением (unit + smoke), `maintenance` снимается при `off` источника.
- **AC2** — hazard-классы (`smoke/gas/carbon_monoxide/moisture/safety/tamper`),
  `siren`, `triggered` panel не проходят через ветку service-понижения вообще
  (другой domain/device_class). Чужая platform, неизвестный `translation_key`
  даже с похожим `unique_id` suffix, совпадающее имя — все остаются `alarm`
  (unit `AC2`, обычные отрицательные случаи в самом тесте, тест умеет падать).
- **AC3** — `resolvePresentationSources` собирает `issues` по `d.entities`
  (не по всему registry), дедуп по `eid` через `Map`, alarm/maintenance не
  путаются (unit `AC3/6`, smoke: две группы видны одновременно с aquastop=on).
- **AC4** — `device-issues-view.ts` — общий read-only рендер для карточки и
  preview; кнопка `openSource` вызывает только `hass-more-info`/`dispatchEvent`,
  `callService` не вызывается (smoke проверяет `window.__972Calls === []`).
  Технические подробности раскрывают `entity_id`/`state`/`deviceClass`.
  Проверено исполнением (smoke: touch/keyboard/kiosk/can_write=false/4 языка).
- **AC5** — `test/device-issues.test.mjs` (`AC5`) гоняет `incremental` против
  `full` capture на снятии/возврате/смене platform/отключении/переименовании/
  смене `device_id` — `deepEqual` на каждом шаге, плюс `Object.isFrozen` на
  принятом списке. Доказано исполнением.
- **AC6** — `neutralFace` (`static_icon`/`value_static_icon`) гасит badge
  (`maintenance: !neutralFace && ...`), но карточка всё равно читает полные
  `issues`: `houseplan-card.ts:_renderInfoCard` пересчитывает presentation с
  `sourceDetails: true` только для `static_icon` (единственный «sourceless»
  fast-path), `value_static_icon` и так не sourceless — сверено чтением и
  smoke (`${display} explains service without painting a warning`).
  `live_states:false` не прячет предупреждение — `resolveDevicePulse`
  затрагивает только пульс, не `maintenance`/`issues`; подтверждено unit AC6.
  Hidden/disabled/orphaned/virtual дают пустой `issues` (unit AC6, явные
  ветки `effectiveHidden || haDisabled || orphaned ? [] : sources.issues`).

Защитная таблица «AC · чем доказан · чем краснеет» в хендоффе автора
заполнена по всем строкам (не пустой третий столбец) — сверил с реестром
мутантов и с отрицательными случаями внутри самого unit-файла.

## Находки

### Medium (в скоупе) — дублирующая запись в обоих changelog

`docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`, раздел `## Unreleased`: две
почти идентичные строки про #972 подряд (коммиты `03eb412be` и `fedb30606`
каждый добавил свою строку вместо правки предыдущей):

```
- Explain all active device alarm sources in the info card and preview. Verified Home Connect maintenance reminders use a passive yellow wrench instead of red alarm pulsing, including while the appliance is off. (#972)
- Explain all active device alarm sources in the info card and preview. Verified Home Connect maintenance reminders use a passive yellow wrench instead of red alarm pulsing, including while the appliance is off. Keep its glyph aligned at every marker scale. (#972)
```

(то же самое дублирование параллельно в RU-файле). Это дефект пользовательского
документа: тот же номер issue дважды с почти совпадающим текстом попадёт в
опубликованный changelog беты как есть — ни одна строка не ссылается на
другое число или источник, но для читателя выглядит как два отдельных пункта
об одном и том же. Воспроизведение: `git diff origin/dev...HEAD --
docs/CHANGELOG.md docs/CHANGELOG.ru.md` либо открыть файл на `## Unreleased`
— строки видны невооружённым глазом. Чем краснеет: обычное чтение файла,
не нужен мутант — редакционный дефект, а не логический.

Исправление: объединить две строки в одну (вторая уже является надмножеством
первой — "align glyph at every marker scale" можно добавить предложением к
первой) в обоих файлах, в той же задаче, без нового issue (Medium в скоупе).

### Low (не блокирует, не открывает цикл)

`demo/golden/matrix.mjs` — у `OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT`,
`STAGE6_ACCEPTANCE_SCENARIOS` и в хвосте `GOLDEN_SCENARIOS` добавлены лишние
пустые строки перед закрывающей скобкой массива (чисто косметика, без
влияния на данные/тесты — счётчики сцен и хэши совпали). Можно убрать
по вкусу, не блокирует.

## Что проверено и корректно

- Трейлеры: `Issue: #972` на каждом коммите класса A/B; `User-Visible: yes`
  ровно на двух коммитах (`03eb412be`, `fedb30606`), оба правят **оба**
  changelog в том же коммите (сверено `git show --stat`).
- `docs/release-ledger/v1.81.0/972.json`: `stable-fix` с обоснованным
  суждением автора — баг уже был в v1.81.0 (пустой `git diff --stat v1.81.0
  v1.82.0-beta.2` по пяти модулям resolver, зафиксировано в самом issue) —
  согласен, это не `introducedBy` внутри-бетной фичи.
  Пользовательский summary RU/EN не дублирует и не противоречит changelog.
- Бюджеты: `INITIAL_VIEW_GZIP_CEILING` 327895→330000 и
  `scripts/monolith-baseline.json.bundleBytes` 3237078→3247518 — точно
  совпадают с измерениями, которые автор назвал и обосновал прямым
  разрешением владельца в issue-треде (комментарий
  `#972-issuecomment-6287170477`); полоса 2000 B и абсолютная стена 352000 B
  не изменены.
- i18n: 18 новых ключей `device.issues.*`, полный паритет RU/EN/DE/FR
  (сверил построчно все 4 файла), все 12 `reason`-значений и обе категории
  заголовков покрыты, нет висячих ключей без точки использования.
- Lock-инвариант (AGENTS.md «The lock invariant»): новая кнопка «Открыть
  источник в HA» — исключительно `hass-more-info`, не добавляет новую
  actuation-поверхность; не нарушает инвариант.
- Perf-риск (`devices.styles.ts:253`, `filter:drop-shadow`) — тот же паттерн,
  что уже у `.device-battery` (строка 277, `filter: drop-shadow(...)`),
  не новый класс стоимости; обход `issues` ограничен `d.entities` устройства,
  не сканирует весь HA registry (сверено чтением `resolvePresentationSources`).
- Рефактор `visualHass` (вынесен в начало `resolvePresentationSources`,
  база спредом сменилась с `registryHass` на `hass`) — проверил, что все
  потребители (`sourceOf`/`sourceName`/`sourceStateText`/`entityVisualSample`)
  используют только `.states`/`.entities`/`.formatEntityState`; новая форма
  гарантирует живой `formatEntityState` и живой `.states` с entities из
  полного registry fallback на `hass.entities`, если `registryHass` их не
  даёт — безопасное расширение, не регрессия (cover/light пути раньше шли
  через голый `hass`, теперь единообразно через `visualHass`).
- Model v10 / wire schema не менялись (сверил `device-presentation.ts`:
  новые поля `issues`/`maintenance` — только в runtime-интерфейсе
  `ResolvedDevicePresentation`, не persisted).
- DEVICE-PRESENTATION.md, ARCHITECTURE.md, STATUS.md, DEVELOPMENT.md,
  USER-GUIDE.{md,ru.md} обновлены по теме, без дублирования (в отличие от
  CHANGELOG).

## Вердикт

Один Medium в скоупе (дублирующая запись changelog) без High — жёлтый,
возврат автору в текущем issue, без нового issue.

Побочных находок нет (mode=issues; Medium вне скоупа отсутствует, маршрут
не задействован).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/972-device-issue-reasons`, коммит `c9fbad497010` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8ce223ddb446a382c05a0a44969b1ffaddc56f26`
  ```
  git log --all --format='%H %T' | grep 8ce223ddb446
  ```
- Тело issue: `b8b078601fce96d8ebfe401c47df9b20c501ff35e35d8deaff082274029f22dd`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5OTMsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDkzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDgsIm91dHB1dF90b2tlbnMiOjM2NTQ0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1OTg5OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjkzNjIwMTIsImNvc3RVc2RFc3RpbWF0ZSI6Mi44Nzc3MzA0MDAwMDAwMDA0fV0sInR1cm5zIjo4NywiZHVyYXRpb25NcyI6NTQ3OTA4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi44ODI4MjM0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5141 output_tokens=36564 cache_creation_input_tokens=159898 cache_read_input_tokens=9362012 num_turns=87 -->
