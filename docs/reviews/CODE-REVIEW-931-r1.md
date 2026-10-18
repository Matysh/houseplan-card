# CODE-REVIEW-931-r1

Материал: `f7b80b1806e3a55113ebdfed9c970d619acfd125` (`git log --oneline origin/dev..HEAD`,
`git diff origin/dev...HEAD`, 171 файлов, +6867/-138). Issue #931, трек `ask`,
этап `code`, заход r1, блокирующих циклов израсходовано 0 из 4 до этого вердикта.
ТЗ — тело issue, редакция 2.1 (18 октября 2026). Маршрут вердикта (#726): `route: fix`.

Риск по изменённым участкам (#707) сверен: geometry (`thickness`,
`setWallThickness`, `thicknessCmAt`) покрыт §7/§7.1 матрицей и AC4/AC6; touch
(`pointerdown`) покрыт §11 и AC13; migration (`import_export.py`,
`validation.py` — новый `_finite_number` и `plan_opacity`) покрыт §10 и AC8;
perf (`ResizeObserver`, `filter:`, `getBoundingClientRect`) покрыт §11 и AC14.
Все четыре класса закрыты ТЗ — переквалификация не требуется.

## Скоуп

Issue #931 добавляет общую панель визуальных свойств (360 px, редакторы
«План»/«Устройства»/«Подложка») с матрицей из 14 семейств объектов, целевыми
(targeted) адаптерами записи, новой tagged-командой истории для
scale/angle значка, диалогом вставки HA-переменной в текст и новым полем
`config.spaces[i].plan_opacity`. Это уже третий ТЗ-раунд (SPEC-REVIEW-931-r2/r3
зелёные) — первый код-ревью по итоговой реализации.

## Как проверялось

Дешёвые гейты подтверждены внешним пакетом: зелёный Validate на этом SHA
(`f7b80b18`, run 39150833359, SUCCESS, ci:full + ci:golden). `npx tsc --noEmit`,
`npm test`, `npm run build`+bundle-policy, полный browser/backend/golden/HACS
набор повторно не гонялся — переиспользован этот прогон. Инварианты модели,
backend pytest (574 passed/1 skipped) и mutation-registry readiness взяты из
авторского `docs/reviews/evidence-931/README.md`/`golden.md` и подтверждены
чтением исходников, а не перезапуском.

Корректность кода проверена чтением всех изменённых модулей
`src/editors/properties/*.ts`, затронутых интеграций
(`houseplan-card.ts`, `houseplan-editor-runtime.ts`, `device-position-history.ts`,
`physical-body-gesture.ts`, `stairs-editor.ts`, `geometry-history-state.ts`),
backend (`validation.py`, `import_export.py`, `support_package.py`,
`support_wire_schema.py` + его копии в `scripts/support-relay/`),
доказательной базы (`docs/reviews/evidence-931/README.md`, `golden.md`),
unit-тестов (`test/properties-*.test.mjs`) и смоука
`demo/smoke_properties_panel.mjs`. Отдельно — попарное визуальное сравнение
PNG из `docs/design/931-properties-panel/approved-2026-10-18/` с
`docs/reviews/evidence-931/actual/` (независимая визуальная приёмка AC2,
как того явно требует методика §13.1 — «обычный зелёный golden… не закрывает
AC2», «ручная повторная аттестация… не обязательна; проверка возлагается на
исполнителя и независимого ревьюера»).

## Находки

### 1 (High). AC2: несколько необъявленных расхождений с утверждёнными эталонами

Методика §13.1 — обязательная визуальная приёмка — требует точного совпадения
подписей, порядка, RO/disabled-состояний и действий; «неисправленное
расхождение согласованного внешнего вида блокирует приёмку», и этого не
заменяет ни зелёный golden, ни авторское измерение границ в
`measurements.json`. Независимое попарное сравнение нашло четыре расхождения,
ни одно из которых не раскрыто в разделе «Semantic differences» документа
`docs/reviews/evidence-931/README.md`:

- **Подзаголовок проёма и стены контура всегда общий, а не предметный.**
  Эталон `02-plan-opening-panel.png` показывает «Первый этаж · гостиная —
  кухня» (этаж + две смежные комнаты); факт — «Дверной проём · Первый этаж»
  (общий паттерн «тип · этаж»), название комнат нигде не появляется. То же для
  стены контура: эталон `07-plan-contour-panel.png` — «Контур гостиной ·
  Первый этаж» (родительный падеж имени своей комнаты), факт — «Контур
  комнаты · Первый этаж» (статичное слово «комнаты»). Причина —
  `src/editors/properties/catalog.ts:231-234`: `meta` специально считается
  только для `partition`/`contour`/decor-фигур `rect|ellipse|line`, но формула
  для `contour` (`strings.ts`: `contour_meta: 'Контур комнаты · {space}'`)
  подставляет в `{space}` только название этажа, никогда — имя владеющей
  комнаты; для `opening` отдельной ветки нет вовсе, и он попадает в общий
  fallback `${kind} · ${space.title}`. Это не точечный сбой теста, а
  отсутствующая композиция «этаж + комнаты/владелец» для всех типов, кроме
  трёх явно перечисленных — у LED/device/stairs/column её тоже нет, но для них
  эталон случайно использует тот же общий паттерн, поэтому разница заметна
  только на проёме и контуре. Воспроизведение: открыть панель на дверном
  проёме с двумя разными смежными комнатами — подзаголовок не покажет их
  имена.
- **Иконка «Вернуть картинку» — не та.** Эталон `08-plan-backdrop-panel.png`
  показывает круглую стрелку возврата; факт показывает ту же шестерёнку, что
  и у кнопки настроек устройства. `catalog.ts:189` создаёт поле действия без
  `icon`; `surface.ts:102` берёт `field.icon ?? 'settings'`; в таблице путей
  `surface.ts:44-56` вообще нет отдельного глифа reset/undo.
- **Текст подсказки недоступного «Удалить» у картинки плана не совпадает ни с
  эталоном, ни с ТЗ §12.** Факт (`strings.ts`, `backdrop_delete_reason`):
  «Изменить или удалить картинку можно в настройках пространства.» ТЗ и
  эталон: «Чтобы убрать картинку, измените вид подложки в настройках
  пространства.» Это не замена данных (как остальные раскрытые отличия в
  README), а другая формулировка, которая не называет конкретное действие
  (смена вида подложки).
- **Образец заливки в «Оформлении» всегда рисует альфа-шахматку вместо
  сплошного цвета.** Эталон `04-decor-rectangle-panel.png` показывает ровный
  цветной прямоугольник при непрозрачности 65%; факт — тот же образец с
  видимой шахматкой. Причина — реальный логический дефект, не только
  пиксельное расхождение: `surface.ts:94-96` одновременно ставит атрибуты
  `cover-swatch` и `flat-swatch` на `<hp-color-opacity>`; собственный
  геттер компонента `_solidSwatch` (`src/hp-color-opacity.ts:895-896`) — это
  `this.flatSwatch && !this.coverSwatch`, что при обоих выставленных
  атрибутах всегда `false`. `flat-swatch` используется в кодовой базе только
  здесь (`grep` не находит других мест), то есть атрибут, введённый этой
  задачей, не имеет эффекта ни при каких условиях — панель никогда не
  показывает заявленный компонентом «solid plate»-режим (комментарий
  `hp-color-opacity.ts:891-894` прямо описывает этот режим как
  предназначенный для подобных случаев).

Эти четыре пункта в скоупе задачи (панель и её контролы, не внешняя demo-
оболочка), не относятся к уже раскрытым авторским различиям иллюстративных
данных (физический отступ 244 см, текстовые границы, HA-значение и т.п.) и не
покрыты измерением границ в `capture.json`/`measurements.json` (оно сверяет
только геометрию ≤1 CSS px, не текст подписи, не иконку, не наличие
шахматки). Это именно то, для чего методика §13.1 требует отдельного
«независимого визуального ревью кода», а не полагается на авторский
pixel-diff.

### 2 (Medium). AC10: нет негативного свидетеля для исключительности диалога у стен/колонн/проёмов/лестниц/декора

Контракт §6 п.8/§8 (единственная активная поверхность редактирования, панель
`inert`, пока открыт любой из сохранённых полных диалогов) в r2 был Medium —
в редакции 2.1 он закрыт в коде: `PropertiesEditor.beforeIntent`
(`editor.ts:224-237`) вызывается перед открытием диалога стены/колонны
(`houseplan-editor-runtime.ts:2805-2824`), декора/текста/мебели/изображения
(`:3934-4010`), подложки (`:4724-4734`), проёма (`:5786-5805`), лестниц (через
`beforeDialog`, `stairs-editor.ts:280-293`) и устройства (`:7227-7233`) —
симметрично для всех типов, не только устройств. `_editorSecondaryDialogBlocked`
(`houseplan-card.ts:8735-8748`) агрегирует флаги всех этих диалогов в один
`inert` на `<aside>` (`surface.ts:135-137`). Чтением подтверждено: пункт
реализован корректно.

Но «чем краснеет» для этой части AC10 пусто: `demo/smoke_properties_panel.mjs`
проверяет `inert` только для диалога устройства (`properties.full_dialog_makes_panel_inert`,
строки 99-101); цикл по всем 14 семействам (строки 196-221) открывает только
*выделение*, не диалог, и проверяет лишь «нет записи конфига» — ни одного
диалога стены/колонны/проёма/лестницы/декора он не открывает и `inert` не
проверяет. `test/properties-editor.test.mjs` не содержит ссылок на
`beforeIntent`/`inert` вовсе. В `scripts/mutation-registry.mjs` тоже нет
мутанта на `beforeIntent`/`_editorSecondaryDialogBlocked` для не-device путей.
Собственный заявленный способ доказательства AC10 («Plan/Background
table-driven dialog routing с pending/error и обеими ширинами») для этих
путей не исполнен. Регресс в любом из пяти неустроенных вызовов (например,
отмена `beforeIntent` в `_openDecorProperties`) сейчас не упадёт ни на одном
гейте.

## Что проверено и корректно

- **Целевые адаптеры записи** (§10, AC8): `patchPropertiesTarget`
  (`patch.ts`) не вызывает ни `_saveMarker`, ни `SaveDecor` — grep по
  `src/editors/properties/*.ts` ничего не находит; все коммиты идут через
  `_prepareConfigCandidate`/`_commitPhysicalGeometry`/узкие merge-патчи,
  читающие текущее состояние перед записью. Decor legacy-конвертация
  (`width_cm`→удалить `width`, `size_cm`→удалить `size`/`scale`) срабатывает
  только на изменении именно этого поля; `_updateDecorStyle` вызывается
  только при правке `stroke`/`fill`/`width_cm`, не при выборе/перемещении.
- **Новая tagged-команда для scale/angle значка** (§9, AC11):
  `DeviceVisualState` (`device-position-history.ts:23-26`) хранит только
  изменённые ключи с `present`/`value`, не весь Marker; `applyDeviceVisualFields`
  удаляет отсутствующие ключи вместо материализации default; Undo/Redo
  проверяет `expected`-поля перед откатом и восстанавливает только позицию
  своей команды в `CommandStack`, не трогая более новые чужие команды.
  Подтверждено читением `editor.ts:437-489`, `houseplan-card.ts:5506-5510` и
  тестами `properties-editor.test.mjs:76-95`, `properties-patch.test.mjs:42-53`.
  Регресс здесь ловит зарегистрированный `properties-visual-history-rewinds-marker-siblings`
  (не исполнялся — ночной мутационный прогон).
- **`plan_opacity`** (§10, AC8): строгая валидация (`_finite_number`,
  `validation.py:1846`, отклоняет `None`/bool/строку/NaN/Inf — тест
  `test_backdrop_opacity_is_optional_finite_not_null` проверяет именно
  отрицательные значения, не только happy path); WS round-trip через реальный
  `config/set`→`config/get`→диск→`async_reload` параметризован
  `[None, 0, 0.375, 1]` (`test_ha_websocket.py:59-87`); поле присутствует в
  `import_export.py:91`, `support_package.py:437` (копируется только при
  наличии ключа — без самопроизвольного появления) и в обеих копиях
  `support_wire_schema.py`. Фронтенд пишет только `plan_opacity`, не трогая
  `plan_x/y/scale/angle` (`transforms.ts:106`, `patch.ts:33-35`); отдельный шаг
  истории заведён через `geometry-history-state.ts` (1-строчный, сопровождаемый
  snapshot/restore в рантайме). `docs/CONFIG-COMPATIBILITY.md` честно описывает
  предел отката на старых валидаторах. Мутант `properties-null-opacity-becomes-zero`
  и `properties-plan-only-export-drops-opacity` зарегистрированы, не
  исполнялись.
- **Идентичность выбора** (§6.1): `resolvePropertiesTarget`
  (`catalog.ts:31-62`) резолвит по стабильным `spaceId+editor+kind+objectId(+binding)`
  из актуального состояния, а не по снимку рендера; LED↔marker переключение и
  orphan-ленту обрабатывает отдельными проверками `binding`.
- **Физическая опора проёма** (§7.3, AC6): `selectOpeningReference`
  (`physical.ts`) сортирует по дистанции и стабильному `roomId/side/endpoint`;
  `refreshOpeningReference` сохраняет выбранный угол при переходе через
  середину — соответствует требованию «не переключать опору». Мутант
  `properties-opening-reference-follows-nearest` зарегистрирован.
- **Парсер чисел** (§9): `parsePropertiesNumber` (`controller.ts:34-51`)
  строгим regex отклоняет частичный ввод/суффиксы, `Number.isFinite`
  отклоняет NaN/Infinity; `PropertiesFieldController` (`controller.ts:93-182`)
  реализует ровно описанный в §9 контракт (no-op = 0 записей, pending
  блокирует повтор, `external_change`/`authority` инвалидируют устаревший
  draft, Enter+blur не дублируют commit).
- **Доступность** (§11, AC13): `aria-disabled` + `role="tooltip"`-обёртка
  с CSS `:hover, :focus-within` (`surface.ts:151-154`, `styles.ts:113-114`) —
  подсказка доступна клавиатурой, не только через нативный disabled+title;
  `role="status"` для pending, `role="alert"` для ошибок; `keydown` внутри поля
  останавливает всплытие, чтобы Delete/Undo не перехватывали ввод
  (`editor.ts:74-75`). `ResizeObserver` создаётся и гарантированно
  отключается парой (`editor.ts:116,135,140`), привязано к `disconnectedCallback`.
- **Lazy-граница** (§11, AC14): `test/editor-runtime-loader.test.mjs`
  по-прежнему проверяет отсутствие статического импорта runtime в
  `houseplan-card.ts`; `INITIAL_VIEW_GZIP_CEILING` диффом не тронут, изменён
  только `LAZY_EDITOR_GZIP_CEILING` (283 610→312 703) и
  `monolith-baseline.json` — с комментарием на подтверждённое владельцем
  разрешение (`issuecomment-6250557931`, проверено `gh api`: «Да, пересчитать
  по итоговому замеру #931… Прежние полосы допуска и ограничения initial View
  сохраняются»).
- **Терминология «Ширина проёма»** (§7.3, §12): `opening.length_label`
  исправлен в обоих языках, storage-ключ не переименован; тест
  `properties-i18n.test.mjs` отдельно проверяет отсутствие «Length»/«Длина» в
  этом ключе плюс RU/EN-покрытие и совпадение подстановок для всех
  `PROPERTIES_KEYS`.
  Релиз-артефакты: трейлеры `Issue:`/`User-Visible:` на каждом нетривиальном
  коммите, `docs/CHANGELOG.md`/`.ru.md` правятся в тех же коммитах, что
  `User-Visible: yes` (8918370e, 73a70733, 329fa0ae — проверено `git show --stat`);
  `docs/release-ledger/v1.81.0/931.json` классифицирует `major` с обоснованием
  (новая пользовательская возможность, не правка существующей) — согласуется
  с `User-Visible`. `docs/USER-GUIDE.ru.md` получил раздел панели и обновил
  строку «Клик по маркеру» для таблицы устройств; формулировки не придуманы
  заново, согласуются с §5/§6 ТЗ. Одно число, видимое дважды (360 px ширины
  колонки) — единственный источник: `panel.boundingBox().width` в смоуке
  (`properties.fixed_width`) и строка `docs/USER-GUIDE.ru.md` «при ширине…
  от 960 px» согласованы с эталоном §5, отдельного второго числового
  источника нет.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`, `npm test`, `npm run build`+bundle-policy —
  переиспользован зелёный Validate на этом точном SHA (run 39150833359,
  SUCCESS, см. промпт).
- Не запускал `demo/smoke_*.mjs` и `golden:verify` локально — полагался на тот
  же прогон Validate (метки `ci:full`+`ci:golden`) и на то, что независимая
  попарная визуальная проверка (находка 1) не входит в golden-матрицу и её
  нельзя подменить повторным прогоном golden.
- Не перегонял `python -m pytest tests_backend` — полагался на Validate и
  прямое чтение тестов (`test_ha_websocket.py`, `test_validation.py`,
  `test_ha_import_export.py`), подтвердивших не только happy-path.
- Не исполнял `node scripts/model-invariants.mjs` — полагался на авторский
  отчёт (zero violations) и Validate.
- Не исполнял ни один из 10 новых и ни один из прежних registry-мутантов —
  запрещено вне ночного workflow (общая политика, #905); они остаются
  зарегистрированными, не исполнявшимися свидетелями.
- Не проводил ручную GPU/устройство-приёмку — добровольна для владельца
  (REVIEWER.md, #929), её отсутствие не находка.
- Не перепроверял каждый из 31 принятых golden-кадров пиксель-в-пиксель —
  принял документированное построчное обоснование `docs/reviews/evidence-931/golden.md`.
- Расхождение «текстура выделения на плане» (эталон: сплошная заливка;
  факт на `01-plan-wall.png`: похоже на штриховку) замечено при сравнении, но
  не включено в находки: CSS `.hp-prop-selection` (`styles.ts:121-122`) задаёт
  сплошной `stroke`, без `dasharray`; вероятная причина — существующая,
  не относящаяся к #931 текстура холста под декоративной ручкой макета, а ТЗ
  §6 п.1 прямо разрешает не копировать «декоративную ручку макета» как новую
  геометрию. Не настаиваю на этом как на дефекте без дополнительного
  воспроизведения.

## Побочные находки

Побочных находок нет (все находки — по изменённым панелью файлам, в скоупе
issue #931; маршрут согласно доверенному снимку `mode=issues` не
применяется, т.к. вне-скоуповых Medium не обнаружено).

## Вердикт

Жёлтый: 1 High (AC2, четыре необъявленных визуальных расхождения) + 1 Medium
в скоупе (AC10, отсутствующий негативный свидетель для исключительности
диалога у стен/колонн/проёмов/лестниц/декора). Обе находки возвращаются
автору в текущей задаче, новый issue не заводится. Основная инженерная база
(целевые адаптеры, история, identity, backend-миграция, доступность,
бюджеты) прочитана целиком и подтверждена корректной.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/931-properties-panel`, коммит `f7b80b1806e3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b74ff2d47d1dd9a84ddf9aee6b3d52b05f0793a9`
  ```
  git log --all --format='%H %T' | grep b74ff2d47d1d
  ```
- Тело issue: `fc83586d9015abc967f67e1357a944d35b241d9b2803fe113c9714cc31dd5e8d`
- Вердикт конвейера: `yellow` · High 1 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyNjUsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzU0OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDA2LCJvdXRwdXRfdG9rZW5zIjoxMTg1MzIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NTY1NjI3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjExMDI0NDAsImNvc3RVc2RFc3RpbWF0ZSI6Ny4xNDMyNTk0OTk5OTk5OTd9XSwidHVybnMiOjExNiwiZHVyYXRpb25NcyI6NzQ4NDI3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Ny4xNDg2MTQ0OTk5OTk5OTcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5671 output_tokens=118550 cache_creation_input_tokens=565627 cache_read_input_tokens=21102440 num_turns=116 -->
