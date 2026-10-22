# CODE-REVIEW-1022-r1

Issue: #1022 «Конвертер: импорт расстановки устройств из карточки picture-elements»
Этап: code · заход r1 · трек: show · блокирующих циклов использовано 0 из 2
Материал: `d28ca9ce4da23917b5a0aa5097c470f450b76271` (рабочая копия ровно на нём)
Побочные находки: policy `mode=issues` (issue #1022, stage code, round 1) — см. ниже; побочных находок вне скоупа нет.

## Скоуп

Третий источник конвертера `houseplan.tech/convert`: карточка Home Assistant
`picture-elements` → документ импорта House Plan (подложка-ссылка + устройства/
живой текст на местах картинки; комнаты/стены/масштаб — не переносятся).
Диапазон `git diff origin/dev...HEAD`: 27 файлов, +1111/−30. Класс изменений —
только B (`scripts/sh3d-convert/**`, `test/**`, `tests_backend/**`) и C/D
(документация, CI-реестры, пересобранный `dist/index.html` конвертера);
`src/**` и `custom_components/houseplan/*.py` не тронуты.

Коммиты (все с `Issue: #1022`, трейлеры корректны, `User-Visible` расставлен
верно): `feat(converter)` — `User-Visible: yes`, оба CHANGELOG в этом же
коммите; три `chore(ci)`/`test(backend)` — `User-Visible: no`, без changelog
(верно).

## Как проверялось

Зелёного `Validate` на `d28ca9ce4` конвейер не нашёл, поэтому дешёвые гейты
прогнаны мной лично, на материале как есть (рабочая копия не менялась и
восстановлена после сборки):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ok, без вывода |
| Полный unit-набор | `npm test` (`tsc -p tsconfig.test.json && fix-test-build && node --test test/*.test.mjs`) | 5549 passed, 1 skipped (предсуществующий), 0 failed |
| Сборка + бандл | `npm run build` затем `node scripts/bundle-policy.mjs --verify` | build ok (30.4s); verify: «свежая сборка dist цела (60 ассетов); закоммиченная копия не сверяется — бандл меняет только кандидат (#657)» — ожидаемо для не-`Release` коммита. `dist/` восстановлен (`git checkout -- dist && git clean -fd dist`) после проверки |
| Офлайн-страница конвертера | `node scripts/sh3d-convert/build-page.mjs --check` | «ok: offline converter matches its sources and canonical runtime» |
| Backend (без HA) | `/tmp/venv (py3.12)` → `pytest tests_backend/test_picture_elements_convert.py tests_backend/test_sh3d_convert.py tests_backend/test_easy_floorplan_convert.py` | 26 passed; заголовок честно печатает «HA harness NOT collected: 27 test_ha_*.py files (484 tests)» |
| Целевые unit-тесты фичи и CI-реестров | `node --test test/picture-elements-convert.test.mjs test/sh3d-convert-page.test.mjs test/converter-consumers.test.mjs test/easy-floorplan-convert.test.mjs test/ci-registry-inputs.test.mjs test/ci-profiles.test.mjs test/process-digests.test.mjs` | все зелёные (входят в `npm test` выше; прогнаны отдельно для адресной проверки) |

**Чего не проверял:** HA-гарнитур (`test_ha_picture…`/`test_ha_easy_floorplan_convert.py`/
`test_ha_sh3d_convert.py`) — песочница на Python 3.12, пакет
`pytest-homeassistant-custom-component` требует 3.13/3.14, которых в среде нет;
собрать venv с нужной версией не стал (вне объёма дешёвых гейтов этого раунда).
Автор заявляет зелёный прогон на venv Python 3.14, 38 passed, включая HA
round-trip с новым golden — это утверждение не перепроверено исполнением,
только чтением диффа `test_ha_easy_floorplan_convert.py`/`test_ha_sh3d_convert.py`
(ниже). Браузерную Playwright-пробу страницы (клик по кнопке «Выбрать картинку
плана», реальный `createImageBitmap`) не повторял — автор привёл шаги и
результат («5 devices · 2 decor elements», 0 сетевых вызовов), приемлемо для
`show` без ручной приёмки (§7.1, #929). Полный golden/мутационный реестр не
гонял — ночной, не гейт ревью (#709); «чем краснеет» ниже закрыт обычными
исполненными negative-тестами, не мутантами.

## Находки

### Medium (в скоупе) — трек `show` занижен против собственного ТЗ, маршрут `route: reclassify`, критерий `ux-contract`

Тело issue #1022, раздел «Границы», пишет буквально: *«Трек: код конвертера
вне `src/**`, но новый пользовательский контракт (сопоставление и коды
отчёта) — предлагать `ask`; решает аналитика.»* Раздел «Что разобрать на
аналитике» оставляет нерешёнными минимум два продуктовых вопроса:

1. `state-label`: живой текст или бейдж значения — «что ближе к тому, как
   люди это используют».
2. `service-button` и `icon` без сущности: виртуальное устройство с действием
   против декора, и нужно ли это в первой версии.

Оба вопроса — это именно новый UX-контракт (какие элементы picture-elements
во что превращаются), который сам владелец в ТЗ отметил как нерешённый и
адресовал аналитике, а не инженеру. Разработчик (комментарий «Взял») вместо
обращения к владельцу или трека `ask` классифицировал задачу как
«инфраструктурный вход» (§1, #562: «класс B, файлов класса A нет») и сразу
вошёл в `S7-code-review`, без ревью ТЗ. Это смешивает два разных измерения:
класс изменения (A/B/C/D, который действительно B) и трек (`show`/`ask`,
который определяется не классом файлов, а наличием нового пользовательского
контракта, §5). Решения по обоим вопросам приняты в одиночку в коде, без
видимого комментария владельца с явной строкой `Трек: … — решение
владельца`:

- `state-label` → **всегда** живой текст (`scripts/sh3d-convert/picture.mjs`
  `labelOf`, note `state_label_as_text`), бейдж не предлагается никогда —
  закрывает вопрос 1 без обращения к владельцу.
- `service-button` и `icon` без entity → **всегда** пропускаются
  (`element_type_skipped`), виртуальное устройство с действием не создаётся —
  закрывает вопрос 2 без обращения к владельцу.
- Дополнительно без обсуждения в ТЗ: `tap_action` `navigate`/`url`/
  `call-service` не мапятся на действия маркера (как буквально просит таблица
  сопоставления в теле issue — «действия маркера по нашей модели»), а падают
  в `info` с кодом `action_fallback_info` (переиспользованный `markerTap` из
  Easy Floorplan, `scripts/sh3d-convert/easy-style.mjs:109-121`, этим диффом
  не тронут). Технически это, скорее всего, верно (в редакторе House Plan
  такого действия у маркера нет — `docs/USER-GUIDE.ru.md:332`), но это тоже
  решение о контракте, задокументированное задним числом в этом же PR
  (`docs/USER-GUIDE.ru.md` новый подраздел), а не зафиксированное заранее.

По критерию `ux-contract` (§5): «нет нового UX-контракта — меняется поведение
в рамках уже описанного». Сопоставление picture-elements → House Plan
(что становится устройством, что — текстом, что отбрасывается, какие коды
отчёта) нигде не было зафиксировано до этого PR — ни в каноне подсистемы, ни
в `docs/USER-GUIDE.ru.md`, ни в закрытом AC прежней задачи; значит критерий
не проходит, и по правилу трека `show` вердикт должен быть `route:
reclassify` с этим критерием, а не предположение, что молчание владельца
равно согласию.

Это **не находка к качеству кода**: сама реализация (валидация,
отчёт, golden, тесты) сделана аккуратно и соответствует тому, что в итоге
было решено. Находка — в том, что продуктовые решения приняты в обход
процесса, предписанного тем же ТЗ. Обычный ревью кода в объёме `show`
(корректность и AC) не блокирует это High, но раз трек приходится
пересматривать — вердикт жёлтый, а не зелёный.

**Воспроизведение:** issue #1022, раздел «Границы» (предложение трека `ask`)
и раздел «Что разобрать на аналитике» (два открытых вопроса) против
`scripts/sh3d-convert/picture.mjs` `labelOf`/основного цикла `convertPicture`
(строки с `state_label_as_text`, `element_type_skipped` для
`service-button`/`icon` без entity) и отсутствия в треде issue строки
`Трек: … — решение владельца`.

Других Medium/High находок к корректности кода, тестов или документации в
этом раунде нет.

## Что проверено и корректно

- **Границы данных и отказ без угадывания.** `pictureCanvas` требует либо
  измеренных `imageWidth/imageHeight` (>0, конечные, соотношение 1:20..20:1),
  либо явный `aspect` в тех же границах; без них — `picture_aspect_required`.
  Проверено чтением и исполнением (`node --test` зелёный, включая
  `#1022 image proportions are never guessed`, которая прогоняет
  `pictureCanvas` через пять некорректных вариантов и проверяет код ошибки).
- **Чтение ровно одной карточки.** `readPicture` требует `type:
  picture-elements`, непустой `image`, массив `elements` (≤
  `MAX_PICTURE_ELEMENTS = 2000`), объектные элементы/`style`; использует
  общий ограниченный YAML-ридер `readCard`, вынесенный из `easy-read.mjs`
  (без алиасов/директив/множественных документов — уже проверенная
  инфраструктура Easy, в этом диффе не изменена по существу). Negative-тест
  `#1022 только одна карточка...` исполняет все отказы, включая
  `easy_unsafe_yaml`/`easy_invalid_yaml`/`easy_too_complex` (2001 элемент).
- **Позиция = точка картинки, независимо от формы кадра.** Тест
  `#1022 percentages of the image become the same fractions of the
  backdrop...` считает обратное преобразование (`relative()`) для трёх разных
  холстов (измеренный, по аспекту, другой измеренный) и проверяет точку с
  точностью `1e-6`; второй, независимый тест того же факта —
  `test/converter-consumers.test.mjs` «actual backdrop consumer places a
  picture-elements device exactly where the card put it» — использует
  реальный потребитель (`planRect`, `spaceDisplayOf`) вместо своей же
  математики.
- **Перенос семантики элементов** (`state-icon`/`icon` → маркер с `mdi:*`
  иконкой и `tap_action` через общий `markerTap`; `state-badge` → маркер +
  `value_badge.source`; `state-label` → живой текст с токеном сущности,
  экранированием литературных фигурных скобок (`literalCaption`,
  «`❴plain❵`» в тесте) и `color` через общий `colorResolver`) — каждая ветка
  подтверждена отдельным ассертом в `#1022 element kinds: ...`.
- **Ничего не исчезает молча.** `#1022 every element that cannot be
  carried is named once in the report...` перебирает 13 веток (custom-карта,
  `conditional` со счётом вложенных, `image`, `service-button`, декоративная
  `icon` без entity, позиция в px/`calc()`, без `left/top`, вне 0–100 % по
  обеим осям, невалидный `entity` → `binding_virtualized`, нестандартный
  `transform`, прочий CSS по именам полей, числовые проценты и
  `transform: translate(-50%, -50%)` как обычный случай) и проверяет код,
  `id` и (где есть) набор полей для каждой.
- **Отказ, когда переносить нечего.** `picture_nothing_to_convert` бросается
  с заполненным `error.report` (проверено: `report.levels[0].notes.length ===
  2`), а не тихой пустой карточкой.
- **Переводы полны.** Отдельный тест перебирает все коды заметок/ошибок и
  ключи UI (`picture.*`, `drop.picture`) по обоим языкам
  (`test/picture-elements-convert.test.mjs` + `test/sh3d-convert-page.test.mjs`
  «переводы полны»).
- **Страница не расходится со сборкой.** `build-page.mjs --check` зелёный;
  `test/sh3d-convert-page.test.mjs` гоняет picture-конверсию внутри собранного
  артефакта и сверяет с тем же golden, что и модульный тест — страница и
  модуль не разъехались.
- **Бэкенд: документ проходит настоящую схему.** `test_picture_elements_convert.py`
  валидирует golden через `CONFIG_SCHEMA` и `commit_wall_segment_model` (а не
  переизобретённую проверку), подтверждает отсутствие геометрии
  (`rooms == walls == partitions == []`), `content_manifest` ровно с одной
  ссылкой на подложку, согласованность `layout`/`markers`/`placement_manifest`,
  наличие включённого `value_badge` и текста с токеном. Прогнано мной
  (26 passed, без HA-гарнитура).
- **SH3D-плоскостные гейты не обмануты пустым множеством.** Фильтры golden в
  `test_sh3d_convert.py`/`test_ha_sh3d_convert.py` расширены с `easy-` на
  `(easy-, picture-)` — та же логика, что уже защищала Easy (гейт не остаётся
  зелёным на пустом списке, `assert files`); чтением проверено, что это
  простое расширение кортежа префиксов, без потери покрытия SH3D-файлов.
- **Округление позиций при импорте.** Автор утверждает, что продукт не
  округляет позиции при импорте (только перетаскивание в редакторе). Прочитал
  `custom_components/houseplan/import_export.py` и `websocket_api.py` — ни
  `snap`, ни округление координат маркеров в пути импорта нет; подтверждаю
  чтением, не исполнением (единственный механизм выравнивания — фронтовый
  `align-grid.ts`, применяемый при интерактивном перетаскивании, не при
  импорте). Граница задачи («продукт не меняется, если округление уже
  отключаемо») соблюдена корректно.
- **CLI и общий `readCard`.** Вынос `readCard` из `readEasy` поведенчески
  нейтрален: прежняя проверка `!record(config) || config.type !== '...'`
  разложена на `readCard` (запись) + отдельную проверку типа в `readEasy`;
  `test/easy-floorplan-convert.test.mjs` зелёный в полном прогоне `npm test`,
  регрессии не внесено. CLI корректно добавил `--format picture
  --width/--height/--aspect`, лимит размера файла (8 МиБ) верно перенесён на
  `picture` вместе с `easy`.
- **Ledger и changelog.** `docs/release-ledger/v1.82.0/1022.json`:
  `category: "major"`, обоснование и `introducedBy` не требуется (новая фича
  поверх предыдущего stable, не внутри-бетная правка); согласуется по
  формату и духу с прецедентом `#937` (тот же паттерн tooling-class/major).
  Число «3 источника конвертера» видно в `page.lead`/CHANGELOG/USER-GUIDE —
  один источник: сам список `<option>` в `shell.html` (3 пункта), остальные
  места — текстовые описания, не независимое число.
- **Терминология UI.** Расхождение буквального текста ТЗ («пользователь
  перетаскивает файл картинки на страницу») с реализацией (кнопка «Выбрать
  картинку плана» → `<input type=file>`, плюс поля ширина/высота) разрешено
  корректно: `docs/USER-GUIDE.ru.md`/`.md` — канонический источник
  интерфейсных формулировок — описывает именно «выберите файл картинки»,
  и реализация ему соответствует; это авторское уточнение неоднозначной
  формулировки ТЗ, а не находка.

## Защитные AC — чем доказано, чем краснеет

| AC (защитный) | Чем доказан | Чем краснеет |
|---|---|---|
| Без пропорций картинки конверсия отказывает, не угадывая | `node --test test/picture-elements-convert.test.mjs` (`#1022 image proportions are never guessed`), исполнено мной, PASS | `assert.throws(... fixed)` без `imageWidth/aspect` → `picture_aspect_required`; `pictureCanvas({aspect:0})`/`{aspect:'x'}`/`{aspect:Infinity}`/узкие `imageWidth:10,imageHeight:1000` → `picture_invalid_aspect`. Обычный исполненный negative case, не мутант |
| Не более `MAX_PICTURE_ELEMENTS=2000` элементов | `#1022 только одна карточка...`, исполнено, PASS | `elements: Array(2001)` → `easy_too_complex`, исполненный negative case |
| Ровно одна карточка `picture-elements`, не панель/стек | тот же тест | `picture-glance`/без `image`/без `elements`/нечисловой `style` → отдельные коды, исполненный negative case |
| Позиция вне `0–100%` или не в процентах не переносится, не искажает геометрию | `#1022 every element that cannot be carried...`, исполнено, PASS | `left:'120px'`, `calc(10% + 2px)`, без `left/top`, `at(101,5)`, `at(5,-1)` → `element_position_unsupported`/`_missing`/`_outside`, исполненный negative case |
| Невалидный/отсутствующий `entity` не становится приватным действием, а виртуализуется | тот же тест | `entity: 'not an entity'` → `binding_virtualized`, исполненный negative case |
| Пусто перенесённое не скачивается молча | `#1022 every element that cannot be carried...` (хвост теста) | `convertPicture` на карточке без живых элементов → `picture_nothing_to_convert` с заполненным `report`, исполненный negative case |
| Golden-документ соответствует реальной схеме бэкенда, без геометрии | `pytest tests_backend/test_picture_elements_convert.py`, исполнено мной (py3.12, без HA), PASS | `CONFIG_SCHEMA`/`commit_wall_segment_model` на golden — обычный positive-путь с явными ассертами `rooms == [] and wall_segments == [] and partitions == []`; отдельного negative-теста на «геометрия появилась» нет, но тест структурно не может стать зелёным, если конвертер начнёт эмитить `rooms`/`walls` (ассерт на пустоту) |

## Унаследовано / предыдущие раунды

Не применимо — это первый раунд (r1); разделы «Закрытие раунда r0» и
«Унаследовано из r0» не ведутся.

## Маршрут находок

`REVIEW_FINDINGS_POLICY`: `mode=issues` (issue #1022, stage `code`, round 1).
Единственная находка этого раунда — Medium **в скоупе** задачи (трек/маршрут
самой задачи #1022), новый issue не заводится; она возвращается автору вместе
с этим вердиктом. Побочных находок вне скоупа нет.

## Вердикт

`route: reclassify`, критерий `ux-contract` — задача вводит новое
сопоставление источник→House Plan (какие элементы становятся устройствами,
какие текстом, какие отбрасываются) и явно оставляет открытыми вопросы,
адресованные в своём же ТЗ «аналитике», но была заведена разработчиком сразу
в `S7-code-review` в обход `ask`/спек-ревью. Код и тесты при этом корректны и
не блокируются по существу (High: 0); именно поэтому вердикт жёлтый, а не
красный — возврат нужен за маршрутом, а не за переделкой реализации.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1022-picture-elements-convert`, коммит `d28ca9ce4da2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `dfbde7d77222f9190ae8d7b70462ccebc1df27a5`
  ```
  git log --all --format='%H %T' | grep dfbde7d77222
  ```
- Тело issue: `d6f899fcef643e0c028aaea7fdac5d49f6cf37d499bd03befa48a9846611e0b0`
- Вердикт конвейера: `yellow` · High 0 · маршрут `reclassify` (критерий `ux-contract`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NDAsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDM0OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTM4LCJvdXRwdXRfdG9rZW5zIjo0MjIxNywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNTkxNjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo4MjQyNTgzLCJjb3N0VXNkRXN0aW1hdGUiOjIuNzA3NjAyNjAwMDAwMDAxfV0sInR1cm5zIjo3NiwiZHVyYXRpb25NcyI6OTg5NzM3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi43MTI2Mzc2MDAwMDAwMDA4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5078 output_tokens=42236 cache_creation_input_tokens=159160 cache_read_input_tokens=8242583 num_turns=76 -->
