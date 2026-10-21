# CODE-REVIEW-945-r2

Issue: #945 «Настройки пространства: связанные разделы и явные переопределения»
Трек: `ask` · Этап: code · Заход: r2 · блокирующих циклов 1/4

Материал: диапазон `origin/dev..HEAD`, вершина `9ef38e974fc81d42527057af06c4649e59f4b9e8`
(рабочая копия на этом коммите; `git rev-parse HEAD` сверен). Предыдущий материал
r1 (`7cddd0b0b34b…`, дерево `3706e6d993c0…`) не резолвится в этом дереве —
ветка была ребейзнута автором между раундами, что явно предупреждено в самом
документе r1 («ребейз его осиротит, и это нормально»); это обычное дело
(REVIEWER.md, «Повторный раунд»), а не находка. Делаю полный разбор дельты по
коммитам после публикации r1-вердикта:

```
661fa616 Use independent Space bases in the existing Room sizing preview
8cc5cea0 test: wait for the card boot before localized signal controls
9ef38e97 test: initialize localized signal cases through HA language
```

ТЗ сверено с текущим телом issue целиком. Тело не менялось со времени r1 —
разделы «Уточнение backend-контрактов по ревью r1» и «Имя хранения локального
режима заряда (уточнение r2)» присутствуют в теле и были уже учтены в r1;
новых правок тела после r1 нет.

## Скоуп

r2 — это закрытие единственной находки r1 (Medium, в скоупе:
`room-settings-dialog.ts` использовал устаревшую единую базу `cardFontScale`
вместо независимых `cardNameScale`/`cardLabelScale` в подсказке и предпросмотре
диалога комнаты) плюс два последовавших ремонта подготовки браузерного смока,
не связанного с продуктовым кодом #945 напрямую, но зацепленного миграцией
формы пространства (таймингом boot/`setConfig`).

## Риск по изменённым участкам (#707) — трек `ask`, сверка с AC ТЗ

Три класса риска (migration/perf/ux), перечисленные в пакете ревью, относятся
к материалу #945 **целиком**; дельта r2 не меняет миграцию (`import_export.py`,
`validation.py` не тронуты этими тремя коммитами — см. «Унаследовано из r1») и
не меняет рендер-путь perf (`iso-scene-render.ts`, `render-snapshot-capture.ts`
не тронуты). Единственный класс, который дельта r2 реально расширяет —
**ux**: новый i18n-ключ `room.sizes_hint_split` (RU/EN/FR/DE) и правка
`room-settings-dialog.ts`/`room-card-preview.ts`-потребления.

| Класс | Участок дельты r2 | AC ТЗ |
|---|---|---|
| ux | `src/editors/room-settings-dialog.ts:270-274`; `src/i18n/settings/{ru,en,fr,de}.json` (`room.sizes_hint_split`) | AC3 — «Существующие множители комнаты применяются к соответствующим базам пространства: имени — к `card_name_scale`, показателей — к `card_label_scale`» |

Класс покрыт строкой AC — понижения трека не требуется, `route: fix`.

## Как проверялось

1. **Прочитан фикс по существу.** `src/editors/room-settings-dialog.ts:270-274`
   теперь берёт `spaceDisplay.cardNameScale`/`spaceDisplay.cardLabelScale`
   раздельно: подсказка `room.sizes_hint` (старый текст с одним числом)
   показывается только когда обе базы равны, иначе — новый `room.sizes_hint_split`
   с обоими числами; `roomCardPreview(...)` получает `cardNameScale` как
   `spaceScale` и дополнительно `cardLabelScale` как 6-й параметр
   `labelSpaceScale` (а не как было — тот же `cardFontScale` для обоих).
2. **Проверена сигнатура `roomCardPreview`** (`src/editors/room-card-preview.ts:6-11`):
   параметр `labelSpaceScale = spaceScale` существовал до этого фикса и уже
   использовался единственным другим вызывающим местом,
   `src/editors/space-form.ts:372-373` (предпросмотр в самой форме
   пространства, где обе базы передавались раздельно с самого #945). То есть
   фикс не меняет сигнатуру, а устраняет единственный вызов, который её
   игнорировал, — регрессии у другого потребителя быть не может, второй
   вызывающий код не тронут. Просчитана математика на числах теста: `base =
   18 * cardNameScale` (1.5) = 27; `cpname = base * nameScale` (2.0) = 54px;
   `cpmeta = 18*0.62 * cardLabelScale(0.75) * labelScale(1.5)` = 12.555 ≈
   12.6px (toFixed(1)) — совпадает с ожиданиями нового смок-теста.
3. **Исполнены оба изменённых браузерных смока локально** (`npm run build` →
   `node scripts/bundle-sync.mjs` → смок), чтобы не полагаться только на
   текстовое чтение фикса основной Medium-находки:
   - `node demo/smoke_space_settings_form.mjs` — **PASS**, все 40 проверок
     `true`, включая три новые: `roomPreviewUsesBothSpaceBases`,
     `roomHintNamesBothSpaceBases`, `roomPreviewCancelKeepsSpace`.
   - `node demo/smoke_signal_visibility_ui.mjs` — **PASS**, все 80 проверок
     (`360/1280 × ru/en × light/dark`) `true`; это подтверждает, что
     ремонт подготовки (`8cc5cea0`, `9ef38e97`) действительно устранил
     флаки-ошибку CI «Resulting promise was garbage collected» без ослабления
     исходных проверок клавиатуры/44px/локализации/наследования/popup.
4. **Прочитан механизм ремонта `smoke_signal_visibility_ui.mjs`** на предмет
   «не ослаблена ли проверка языка»: до фикса язык задавался через
   `card.setConfig({..., language})` (конфиг-приоритет в `langOf()`,
   `src/i18n.ts:22-28`); после — через `card.hass = {...hass, language,
   locale:{...locale, language}}` (fallback-приоритет той же функции).
   Проверено, что исходный `setConfig` демо-страницы
   (`demo/srv/demo.html:209`) не задаёт `language`, поэтому fallback-путь
   `hass.locale.language || hass.language` остаётся единственным активным
   источником языка в обоих вариантах теста — смена механизма не меняет
   наблюдаемый результат, только избегает пересоздания карточки (`setConfig`)
   между итерациями, что и было источником гонки с `updateComplete`.
5. **Проверено, что дельта r2 не трогает Python/миграцию/рендер**:
   `git show --stat 661fa616 8cc5cea0 9ef38e97` — только
   `room-settings-dialog.ts`, 4 locale JSON, `demo/smoke_space_settings_form.mjs`,
   `demo/smoke_signal_visibility_ui.mjs`, `docs/CHANGELOG*.md`,
   `docs/DEVELOPMENT.md`. `custom_components/**`, `iso-scene-render.ts`,
   `render-snapshot-capture.ts` в дельте не встречаются.
6. **Трейлеры** всех трёх коммитов дельты: `Issue: #945` на каждом;
   `User-Visible: yes` только на `661fa616` (пользовательское поведение
   действительно меняется — подсказка/превью диалога комнаты), и в этом же
   коммите правятся оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`.
   `8cc5cea0`/`9ef38e97` несут `User-Visible: no` — верно, это только ремонт
   тестовой инфраструктуры, продуктовый код не меняется (byte-identical,
   подтверждено автором в хендоффе и `git show --stat`).
7. **Прогнаны дешёвые гейты независимо**, не только по ссылке: `npm run build`
   (включает `tsc --noEmit`) — чисто; `npm test` — `5257 pass / 1 skip / 0
   fail` на всех `test/*.test.mjs`, включая неизменившийся в этой дельте
   `test/space-settings-945.test.mjs`.
8. **Проверен CI на точном SHA материала** через `gh run view 39136944682`:
   `headSha` = `9ef38e974fc81d42527057af06c4649e59f4b9e8` (совпадает с
   материалом), `conclusion: success`. Пройдены все существенные джобы,
   включая полный набор (issue несёт `ci:full`/`ci:golden`): «Фронтенд: типы,
   юниты, мутанты, синхрон бандла», «Бэкенд: pytest в Home Assistant»,
   «Геометрия: TS/Python parity», «Перф-смок», все 3 шарда «Смоки в браузере»,
   «Golden-кадры против принятых эталонов». «Мутанты по диффу» — `skipped`,
   что ожидаемо (ночной реестр, не гейт разработки, AGENTS.md).

### Защитные AC — таблица «чем краснеет» (неприменимо к дельте r2)

Дельта r2 не вводит новый защитный AC (валидация/гард/лимит/отказ/инвариант):
фикс — исправление отображаемой базы масштаба в UI-подсказке/превью, его
корректность доказана прямым вычислением (см. «Как проверялось», п.2) и
исполненным смоком с явными числовыми ожиданиями (54px/12.6px), а не
отрицательным пробником защитного инварианта. Защитные AC2–AC5 самого #945
(миграция границ/проёмов, масштабы 0.5–3, цепочка заряда, фон/Glow) этой
дельтой не затронуты — их таблица «чем краредеет» не изменилась с r1 (см.
«Унаследовано из r1»).

## Находки

Нет. Единственная находка r1 закрыта по существу и подтверждена исполнением;
новых находок — High, Medium (в скоупе или вне него) — в дельте r2 не
обнаружено.

## Что проверено и корректно

- Фикс `room-settings-dialog.ts` использует именно `spaceDisplay.cardNameScale`/
  `cardLabelScale` (не производные/приближённые значения), то есть ровно те
  поля, которые реально управляют 2D- и изо-рендером (`houseplan-card.ts:12194`,
  `iso-scene-render.ts:252-253,856`) — подсказка и предпросмотр диалога комнаты
  теперь согласованы с фактическим рендером на плане, что и требовал AC3.
- Единственное другое место вызова `roomCardPreview` (`space-form.ts:372-373`)
  не затронуто и не регрессирует — оно уже передавало обе базы раздельно.
- i18n-ключ `room.sizes_hint_split` добавлен во все 4 локали (RU/EN/FR/DE) с
  текстом, не повторяющим общее условие видимости показателей (соответствует
  требованию ТЗ «не повторять это условие в каждой подсказке» — это отдельная
  фраза про множители, а не про источник данных).
  Старый `room.sizes_hint` сохранён для случая равных баз — обратная
  совместимость восприятия не нарушена.
  Новый ключ покрыт зелёным `npm test` (паритет множеств ключей — часть
  существующего юнит-набора) и исполненным смоком.
- Ремонт `smoke_signal_visibility_ui.mjs` не ослабляет исходные проверки:
  клавиатурный toggle, 44px цель, читаемая локализация, фокус, выбор через
  клавиатуру с `inherit`/локальными значениями, отсутствие сырых ключей в
  списке — все 80 проверок исполнены и зелёные в этой сессии, не только по
  ссылке на CI.
- Трейлеры (`Issue:`/`User-Visible:`) и смена обоих changelog в коммите,
  несущем `User-Visible: yes`, — корректны.
- Material SHA подтверждён (`git rev-parse HEAD` = материал задачи), ссылка на
  зелёный Validate проверена напрямую через `gh run view` на совпадение
  `headSha`, а не принята на слово из текста issue.

## Чего не проверял

- Полное визуальное попиксельное сравнение golden-кадров (4 намеренно
  пересобранные сцены) — не пересматривал PNG-дифф вручную: дельта r2 не
  касается golden-путей (не трогает рендер, геометрию, SVG), и Golden-джоб на
  точном SHA материала зелёный (см. выше).
- `pytest tests_backend` не перезапускал локально: дельта r2 не трогает
  `custom_components/**` (подтверждено `git show --stat`), backend не менялся
  с r1; джоб «Бэкенд: pytest в Home Assistant» зелёный на точном SHA.
- Полная матрица performance/нагрузочных тестов — AC задачи её не называет,
  предрелизные полные наборы не входят в объём ревью (§8); перф-смок джоб на
  точном SHA зелёный.
- `node scripts/invariants...` — геометрия стен/проёмов этой дельтой (и
  исходным #945-диффом в части проверенных ранее файлов) не меняется; джоб
  «Геометрия: TS/Python parity» зелёный на точном SHA.
- Ручная dev/GPU-приёмка владельцем — добровольна (#929), headless-прогон
  смоков не выдаётся за неё.
- Третий (расширенный) разбор классов migration/perf по всему материалу #945
  заново не проводился — они не изменились в дельте r2, полный разбор остался
  в r1-документе (см. ниже).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium (в скоупе): `room-settings-dialog.ts:271-272` показывал подсказку размеров и предпросмотр карточки комнаты, используя устаревшую единую базу `spaceDisplay.cardFontScale` для имени и показателей вместо независимых `card_name_scale`/`card_label_scale`, введённых #945 | Коммит `661fa616` переводит `room.sizes_hint`/`roomCardPreview` на `spaceDisplay.cardNameScale`/`cardLabelScale` раздельно; добавлен переведённый ключ `room.sizes_hint_split` на случай разных баз; новый смок-тест фиксирует и подсказку, и реальные computed font-size предпросмотра (54px/12.6px) | `src/editors/room-settings-dialog.ts:270-274`; `demo/smoke_space_settings_form.mjs` (`roomPreviewUsesBothSpaceBases`, `roomHintNamesBothSpaceBases`, `roomPreviewCancelKeepsSpace` — все `true` при исполнении в этой сессии); `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` запись (#945) в том же коммите |

## Унаследовано из r1

Принято без повторной проверки в этом раунде (материал не менялся дельтой r2,
полностью разобрано и подтверждено в `docs/reviews/CODE-REVIEW-945-r1.md`,
материал того раунда — ветка `issue/945-space-settings`, коммит `7cddd0b0b34b`,
дерево `3706e6d993c0e95e16c6c8465138980fc140659f`):

- Три backend-контракта (`import_export.py::_SPACE_DISPLAY_FIELDS`,
  `support_package.py::_space_settings`, `support_wire_schema.py::SPACE_SETTINGS`
  + relay-зеркало) синхронно несут `card_name_scale`/`card_label_scale`/
  `show_device_battery_mode`; имя поля `show_device_battery_mode` зафиксировано
  по уточнению r2 ТЗ и использовано везде.
- Миграция границ/проёмов (`validation.py:2306-2319`): backend-резолвер
  совпадает с frontend (`not plan_url` ≡ `noPlan`), идемпотентность и
  сохранность геометрии доказаны unit-тестом на 12 комбинациях
  `plan_url × show_borders × hide_openings`.
- Независимые масштабы: fallback на legacy `card_font_scale` без двойного
  умножения; 2D- и изо-рендер компенсируют единую «базовую» переменную верно.
- Цепочка заряда устройств global → space → marker реализована несимметрично
  правильно; кэш снимка учитывает per-space режим заряда в ключе инвалидации.
- i18n: 245 ключей на RU/EN/FR/DE, полный паритет множеств (без указанного
  выше нового ключа r2, который добавлен уже с паритетом в этом раунде).
- Восемь выведенных из v7 контролов отсутствуют в реализации.
- Трейлеры всех 9 исходных коммитов, release-ledger
  `docs/release-ledger/v1.81.0/945.json` (`category: major`, обоснование и
  RU/EN summary) и `Release:`/`Baseline-Reviewed-Local:` на коммите,
  трогающем golden-baseline — проверены и корректны.
- Защитные AC2–AC5 (таблица «AC · чем доказан · чем краснеет» из r1) —
  действительны без изменений, дельта r2 их не затрагивает.

## Маршрут и вердикт

High — 0, Medium — 0 (ни в скоупе, ни вне скоупа). Доверенный снимок политики
находок — `mode=issues`; при отсутствии находок новых issue не заводится.
Побочных находок нет.

Маршрут вердикта — `route: fix` (track `ask`, не `show`; поле `criterion` не
применяется).

Вердикт: **зелёный**.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/945-space-settings`, коммит `9ef38e974fc8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `edff4599b299581a2197e657a353bfd52de24640`
  ```
  git log --all --format='%H %T' | grep edff4599b299
  ```
- Тело issue: `8c57dced2dd92d55c9d6a12b1c0fb12171a934f6e2dac977b98bdc512532c193`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUzNjcsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NDY3MDAwMDAwMDAwMDAwNX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTQwLCJvdXRwdXRfdG9rZW5zIjozNDIxMSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNTY4NjYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo3NDc3NzU4LCJjb3N0VXNkRXN0aW1hdGUiOjIuNDY1NDA1Nn1dLCJ0dXJucyI6ODYsImR1cmF0aW9uTXMiOjc3OTgyOSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNDcwODcyNjAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5507 output_tokens=34231 cache_creation_input_tokens=156866 cache_read_input_tokens=7477758 num_turns=86 -->
