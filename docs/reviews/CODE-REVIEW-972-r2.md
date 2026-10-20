# CODE-REVIEW-972-r2

Материал: `b4554e1ffdcc98a564760feb0c94ad8cffab168b` (`issue/972-device-issue-reasons`,
диапазон `git log --oneline origin/dev..HEAD` — 8 коммитов, `git diff
origin/dev...HEAD` — 42 файла). Трек `ask`, заход r2, блокирующих циклов 1/4.
`REVIEW_CONTEXT.material.bodyDigest` = `b8b078601fce...` — совпадает с тем,
что сверял SPEC-REVIEW-972-r1 и CODE-REVIEW-972-r1: тело issue (раздел `## ТЗ`)
с момента r1 не менялось.

## Скоуп

Без изменений с r1: закрывает J1/J2/J3 (`docs/SCOPE.md`) — подтверждённые
сервисные напоминания Home Connect Local (`machinecarereminder` /
`machinecareandfiltercleaningreminder` / `smartfiltercleaningreminder`,
platform `homeconnect_ws`) больше не красят маркер красной тревогой; пассивный
жёлтый знак на плане плюс общий список текущих причин (alarm/maintenance) в
существующей карточке устройства и в `hp-device-preview`. Настоящие аварии
сохраняют красный приоритет.

## Повторный раунд: граница дельты (§2.10)

Предыдущий заход (r1, документ `docs/reviews/CODE-REVIEW-972-r1.md`,
опубликован коммитом `db98d7206` в `10:11:37Z`) разбирал материал
`c9fbad4970104a40556fd377473680174e2016b9`, дерево `8ce223ddb446a382c05a0a44969b1ffaddc56f26`.
Это дерево дважды осиротело последующими ребейзами (на `dev` с #975, затем
снова при приведении к текущему `dev`) и `git cat-file -t` на нём сейчас
`fatal: bad object` — по §2.10 это обычное дело, не находка: материал ищется
по коммитам/содержимому, а не по мёртвому SHA.

Реконструкция по author-date каждого коммита в объединённой истории (дата
автора переживает ребейз, в отличие от хэша):

| author date (UTC) | коммит сейчас | что это | когда уже видено |
|---|---|---|---|
| 08:39:11 | `ff063805a` | `fix: explain device alarms...` | часть исходной реализации, видел r1 |
| 08:43:49 | `30d57c977` | `test: cover a fresh device alarm...` | часть исходной реализации, видел r1 |
| 08:50:12 | `5534d77d2` | `fix: verify the painted service warning...` (включая правку `src/styles/devices.styles.ts`/`dialogs.styles.ts` — `line-height:0`) | часть исходной реализации, видел r1 |
| 08:54:30 | `e3861ad0b` | `test: lock complete appliance glyphs...` | часть исходной реализации, видел r1 |
| 09:10:11 | `ff3a1c773` | `test: accept the reviewed device issue golden frames` | часть исходной реализации, видел r1 |
| 09:40:35 | `ea5f2fc48` | `chore: retain the measured bundle allowance after the dev rebase` | часть исходной реализации, видел r1 |
| 10:11:37 | `db98d7206` | `docs: review document for #972` (публикация CODE-REVIEW-972-r1.md) | это и есть публикация r1 |
| **10:14:46** | **`b4554e1ff`** | **`docs: consolidate the device issue changelog entries`** | **новый, после r1** |

Единственный коммит, авторски датированный позже публикации r1 (`10:11:37Z`),
— `b4554e1ff`, и он правит только `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`.
Это подтверждается и подсчётом файлов: r1 разбирал 41 файл, сейчас 42 —
разница ровно в один новый файл, сам `docs/reviews/CODE-REVIEW-972-r1.md`
(класс C, публикация предыдущего раунда, не предмет этого ревью).

Ребейз на `dev` принёс #975 (`4a9e614ed`, `9251c544d`, `aa66d13d2`):
`git diff 77d763f260..aa66d13d2b --stat` → только `demo/smoke_version_recovery.mjs`
и документация (`docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/release-ledger/v1.81.0/975.json`, `docs/reviews/CODE-REVIEW-975-r1.md`,
`docs/reviews/INDEX.md`). Ноль пересечения с файлами #972 (`src/device-issues*`,
`device-presentation.ts`, `houseplan-card.ts`, `hp-device-preview.ts`, тесты,
golden) — ребейз не затрагивает код задачи, полный разбор не требуется,
сокращение объёма до дельты оправдано.

**Предмет этого раунда — ровно коммит `b4554e1ff`.** Все AC и risky hunks,
упомянутые в r1, разбирают код, который в дельте не менялся.

## Закрытие раунда r1

| находка | чем закрыта | где это видно |
|---|---|---|
| Medium (в скоупе): `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` получили по две почти идентичные строки про #972 подряд | Коммит `b4554e1ff` объединил обе строки каждого файла в одну; новый текст — надмножество прежних двух (добавлено предложение про выравнивание glyph) | `git show b4554e1ff -- docs/CHANGELOG.md docs/CHANGELOG.ru.md`; после правки в `## Unreleased`/`## Не выпущено` ровно один пункт `(#972)` на файл (проверено чтением текущего файла, см. ниже) |
| Low (не блокировал): лишние пустые строки в `demo/golden/matrix.mjs` | Не затронуто — Low был явно отмечен r1 как необязательный и не открывающий цикл; `matrix.mjs` не входит в дельту `b4554e1ff` | `git diff c9fbad497-era..b4554e1ff` эквивалент пуст для этого файла (файл вообще не в списке изменённых дельтой) — ожидаемо, не регрессия |

## Унаследовано из r1 (без повторной проверки)

Документ: `docs/reviews/CODE-REVIEW-972-r1.md` (коммит `db98d7206`), материал
`c9fbad4970104a40556fd377473680174e2016b9`. Код, который разбирает это
ревью, не изменился в дельте `b4554e1ff` — принимаю без повторного
исполнения:

- AC1–AC6 — разбор чтением и исполнением (unit `test/device-issues.test.mjs`
  6/6 PASS, `demo/smoke_device_issue_reasons.mjs` PASS, 4 новых golden-кадра
  `--scenario=` diff=0px/sha256 совпал с индексом, визуально сверены все 4
  PNG), включая защитную таблицу «AC · чем доказан · чем краснеет» без
  пустых ячеек.
- **Риск «perf» из блока «Риск по изменённым участкам»** —
  `src/styles/devices.styles.ts:253` (`filter:drop-shadow`) — r1 сверил, что
  это тот же паттерн стоимости, что уже у `.device-battery` (строка 277), не
  новый класс; AC6/«Модель данных, миграция и performance» ТЗ покрывают этот
  класс явно (snapshot counters/reuse tests, budget gate, запрет на новый
  polling). Эта строка не входит в дельту `b4554e1ff` — не перепроверял.
- **Риск «ux» из того же блока** — все новые ключи `device.issues.*` в
  `src/i18n/{de,en,fr,ru}.json` — r1 построчно сверил паритет RU/EN/DE/FR и
  отсутствие висячих ключей без точки использования; AC6 и раздел «i18n» ТЗ
  называют это требованием явно (parity всех языков, узкий экран). Файлы
  i18n не входят в дельту `b4554e1ff` — не перепроверял.
- Lock-инвариант (`AGENTS.md`) — кнопка «Открыть источник в HA» только
  `hass-more-info`, не новая actuation-поверхность.
- Модель данных — `issues`/`maintenance` только в runtime
  `ResolvedDevicePresentation`, model v10/wire schema не менялись.
- Бюджеты (`INITIAL_VIEW_GZIP_CEILING` 327895→330000,
  `scripts/monolith-baseline.json.bundleBytes` →3247518) — точные измерения
  с явным разрешением владельца, полоса/стена сохранены; `ea5f2fc48`
  (восстановление `bundleBytes` после ребейза на #973) видено r1.
- `docs/release-ledger/v1.81.0/972.json`: `stable-fix` с обоснованием —
  баг уже существовал в v1.81.0 (пустой `git diff --stat` resolver-модулей),
  согласен с суждением автора.
- Трейлеры `Issue: #972` на каждом коммите класса A/B и `User-Visible: yes`
  ровно на двух исходных коммитах (`ff063805a`, `5534d77d2` — переименованные
  ребейзом `03eb412be`/`fedb30606` из хендоффа), оба правят оба changelog в
  своём коммите — r1 это сверил.

## Проверено заново в r2 (дельта)

- **Трейлеры новых коммитов.** `b4554e1ff`: `Issue: #972` / `User-Visible: no`
  — корректно, это текстовая консолидация уже объявленного пользовательского
  изменения, а не новый факт; `db98d7206` (публикация r1,
  `Issue: #972` / `User-Visible: no`) — класс C, трейлеры необязательны, но
  присутствуют и корректны.
- **Содержимое правки.** Прочитал итоговые файлы:
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — ровно один пункт `(#972)` на
  файл в `## Unreleased`/`## Не выпущено`, формулировка — надмножество двух
  прежних (ничего не потеряно: maintenance vs alarm, выключенный прибор,
  выравнивание glyph при любом масштабе — всё на месте).
- `git diff --check <b4554e1ff~1> b4554e1ff -- docs/CHANGELOG.md docs/CHANGELOG.ru.md`
  → чисто (exit 0), нет whitespace-ошибок.
- **Одно число — один источник (§8).** Дельта текстовая, не меняет ни одного
  отображаемого пользователю числа/метрики (bundle ceiling и raw bytes этим
  коммитом не тронуты — только у `ea5f2fc48`, который уже был в материале r1).
- **Пересечение ребейза с кодом задачи** — `git diff 77d763f260..aa66d13d2b --stat`
  → только `demo/smoke_version_recovery.mjs` + документация #975, ноль
  пересечения с файлами #972 (см. таблицу выше).
- **bodyDigest.** `REVIEW_CONTEXT.material.bodyDigest` = `b8b078601fce...`,
  совпадает с тем, что сверял r1 — ТЗ не менялось параллельно с кодом.

## Гейты

Дешёвые гейты подтверждены независимым зелёным Validate на материале
`b4554e1ff`: https://github.com/Matysh/houseplan-card/actions/runs/39408254299
(`tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify`). Не
перегонял повторно — совпадает с SHA материала этого раунда.

Не прогонял и почему:
- Полный `golden:verify` (216 сцен) / `smoke-select` — предрелизный гейт
  §8, delta не трогает рендер; все риски рендера уже закрыты в r1 на
  идентичном (неизменившемся) коде `device-issues*`/presentation/UI.
- `pytest tests_backend` — в дельте нет Python/`custom_components`.
- `npm run invariants` — в дельте нет геометрии/wall model.
- Повторное исполнение `test/device-issues.test.mjs` и
  `demo/smoke_device_issue_reasons.mjs` на этом конкретном SHA — не требуется:
  код этих модулей идентичен материалу r1 (дельта их не касается), а r1 уже
  исполнил их на предыдущем материале с PASS.
- Мутанты (`device-maintenance-promoted-to-alarm-972` и два UI-мутанта) —
  исполнение вне ночного workflow запрещено (#709/#905); статус
  (`execution=0`, `caught=unknown`) не изменился с r1.
- Ручная dev/GPU-приёмка владельцем — добровольна, отсутствие не находка
  (#929).

## Находки

Новых нет. High: 0, Medium: 0, Low: 0 (Low из r1 остаётся снятым ревьюером
как необязательный, см. «Закрытие раунда r1»).

Побочных находок нет (`mode=issues`, маршрут не задействован — нечего
заводить).

## Что проверено и корректно

- Единственный Medium из r1 закрыт именно так, как требовалось: одна строка
  на файл вместо двух почти идентичных, без потери информации, RU/EN
  синхронно.
- Трейлеры обоих новых коммитов корректны.
- Ребейз на `dev` (#975) не пересекается с кодом задачи — файл-уровневая
  проверка.
- ТЗ (тело issue) не менялось с r1 — `bodyDigest` совпал.
- Дешёвые гейты зелёные на материале этого раунда (ссылка на Validate).
- Весь код, который реализует AC1–AC6 и закрытые риски (perf/ux),
  не менялся в этой дельте — унаследованная верификация r1 остаётся в силе.

## Чего не проверял

- Полный `golden:verify`/`smoke-select`/`pytest`/`invariants`/performance —
  вне объёма; дельта не трогает рендер/геометрию/Python (§8).
- Повторное исполнение unit/smoke/golden конкретно на SHA `b4554e1ff` —
  не требуется, код идентичен уже исполненному материалу r1.
- Мутанты — запрещено вне ночного workflow.
- Ручную dev/GPU-приёмку владельцем — добровольна, не гейт ревью.

## Вердикт

Зелёный. Единственная находка r1 закрыта точно по требованию, без потери
информации; дельта до текущего материала не трогает продуктовый код,
risky hunks (perf/ux) не менялись и остаются закрытыми по r1; ребейз на
`dev` не пересекается с файлами задачи; дешёвые гейты подтверждены на этом
SHA. Route: `fix` (не `reclassify` — трек `ask`, критерий §5 не применяется).

---

## Материал раунда

- Ветка: `issue/972-device-issue-reasons`, `HEAD` = `b4554e1ffdcc98a564760feb0c94ad8cffab168b`.
- Дерево материала: `eef0b7c87304e20da0040fc1ced9710db7a5339a`.
- Тело issue: `bodyDigest` `b8b078601fce96d8ebfe401c47df9b20c501ff35e35d8deaff082274029f22dd`.
- Предыдущий раунд: `docs/reviews/CODE-REVIEW-972-r1.md`, материал `c9fbad4970104a40556fd377473680174e2016b9` (дерево осиротело ребейзом, не резолвится — см. раздел «Повторный раунд: граница дельты»).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/972-device-issue-reasons`, коммит `b4554e1ffdcc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `eef0b7c87304e20da0040fc1ced9710db7a5339a`
  ```
  git log --all --format='%H %T' | grep eef0b7c87304
  ```
- Тело issue: `b8b078601fce96d8ebfe401c47df9b20c501ff35e35d8deaff082274029f22dd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5OTcsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDg2OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTIsIm91dHB1dF90b2tlbnMiOjI3NzIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNTQ3MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI1NDgzODIsImNvc3RVc2RFc3RpbWF0ZSI6MS4yNDg4ODI0MDAwMDAwMDAzfV0sInR1cm5zIjozMywiZHVyYXRpb25NcyI6MzQzNjQ5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yNTM5Njk0MDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5049 output_tokens=27739 cache_creation_input_tokens=115473 cache_read_input_tokens=2548382 num_turns=33 -->
