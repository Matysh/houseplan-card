# CODE-REVIEW-1081-r1

Issue: #1081 · Этап: code · Трек: ask · Заход r1 · Блокирующих циклов 0/4
Материал: `b37e599f7cc4644b2b6daebc7fbe7c688234cb78` (рабочая копия на нём)
Маршрут вердикта: `route: fix`

## Скоуп

Перенос согласованных UI-правок UI-032, UI-034–037, UI-039–045 (замена
UI-033) из UI Lab beta.2 в продукт: рамки мультивыделения декора, анимация и
фокус общего color picker, старт нового пространства с «План и масштаб» и
источником «Нарисовать вручную», клик/pan при размещении мебели,
контекстное меню устройств (4 команды, матрица допустимости по HA binding),
компактное подтверждение удаления устройства, серая отметка показанного
скрытого устройства, курсор вкладок пространств, удаление дублирующего
«Show hidden on plan» из каталога устройств, непрерывная ограниченная сетка
при pan/zoom, баннер занятого пространства. Затронутые документы: `AGENTS.md`,
`docs/SCOPE.md`, `docs/process/REVIEWER.md`, `docs/DECOR-EDITOR.md`,
`docs/CANVAS.md`, `docs/USER-GUIDE.ru.md` — перечитаны; задача обслуживает
J4/J6 (`docs/SCOPE.md`).

## Как проверялось

Static-first: `REVIEW_CONTEXT`, тело issue (раздел «ТЗ», редакция 1,
26.10.2026) и хендофф автора прочитаны один раз. Независимый разбор кода — до
сопоставления с хендоффом — по каждому из 13 согласованных пунктов и по
рискованным участкам, названным промптом (touch/pointerType в
`houseplan-editor-runtime.ts`/`houseplan-card.ts`, perf `getComputedStyle` в
`hp-color-opacity.ts`, новые i18n-ключи `device.*` в `i18n/tools/*.json`).

Авторитетный `validate-gate` для материала
(https://github.com/Matysh/houseplan-card/actions/runs/40340237116, green,
«review-light-golden proof is complete») принят как покрывающий обычные
build/test/gate:small/smoke-select/golden/performance-прогоны, перечисленные
в хендоффе (gate:small PASS 301s; smoke-select 38/40 PASS + 2 целевых
`smoke_help_affordance`/`smoke_editor_styles_lazy` PASS; расширенные
`smoke_ui_lab_1081`/`smoke_ui_lab_grid` PASS; `pytest tests_backend/
test_ha_marker_copy.py` 25 PASS на реальной HA; 20 golden-кадров сняты;
6 RED→6 PASS сеточный исторический свидетель с parity-перфомансом;
интеграционные прогоны после rebase на `dev` и совместно с #1080). Эти
прогоны не повторялись — новый SHA ревью/докс сам по себе не отменяет
пригодное доказательство (§8). Дополнительных пробелов, требующих адресного
`run_check`, в разобранных участках не обнаружено, поэтому собственный
`run_check` в этом раунде не вызывался.

### Разобранные пути (независимо, до сопоставления с хендоффом)

- **UI-032** (`src/editors/decor/group-selection.ts`,
  `src/editors/properties/selection.ts:17-22`): `decor-group` рекурсивно
  вызывает тот же рендер, что и singleton (`renderPropertiesSelection`), без
  отдельной групповой рамки; старый painter контуров фигур не найден нигде в
  `src/` (grep пуст) — соответствует «убрать старую подсветку, не добавлять
  общую рамку». `DecorGroupTextBoxes` кеширует измеренные границы текста по
  id, используется и в singleton, и в групповом путях.
- **UI-034/035** (`src/hp-color-opacity.ts:682-704`, 210-228): `_animatePicker`
  использует `getComputedStyle` один раз на открытие/закрытие (не в горячем
  цикле — обращение к внешнему состоянию при интерфейсе анимации в процессе
  переоткрытия, не per-frame), `160ms cubic-bezier(.2,.7,.2,1)` вход,
  `120ms ease-in` выход, `translateY(±4px)` от стороны триггера
  (`popup.dataset.side`), `prefers-reduced-motion` отключает анимацию и сразу
  закрывает (`_finishPickerClose`). `popup.inert = closing` держит
  закрывающуюся поверхность неактивной. Остаточный фокус: `.trigger[data-
  restored-focus]:focus-visible` снимает рамку после программного возврата
  фокуса, `_tabIntent` сбрасывает `_restoredFocus` при первом `Tab`,
  возвращая обычный `:focus-visible`.
- **UI-036** (`houseplan-editor-runtime.ts:8075-8092, 8426-8446`,
  `space-dialog-draft.ts`, `space-plan-list.ts`, `space-form.ts:291`):
  оба входа создания пространства (`_openSpaceDialog('create')` и
  `_openNextImport`) явно вызывают `selectSettingsSection(host,'space',
  'basics')` при каждом открытии, независимо от последнего раздела другого
  пространства; `newSpaceDialogDraft` всегда даёт `source:'draw'`.
  `loadSpacePlanList` ставит `saved:null,savedBusy:true` до ответа;
  `?disabled=${!d.saved?.length||d.savedBusy}` в `space-form.ts:291`
  блокирует «уже загруженные» при неизвестном/пустом списке. `space.no_plan`
  = «Нет подложки» (RU) / «No plan image» (EN); CSS
  `.hpf-plan-image:has(>.planname.muted){align-items:flex-end}` + `padding:
  12px` даёт нижнее левое положение подписи.
- **UI-037** (`furniture-placement-press.ts`, `houseplan-editor-runtime.ts:
  3819-3917, 4680-4781`, `houseplan-card.ts:6952-7240`): порог
  `STAGE_TAP_DISTANCE_PX=8` общий с камерой (используется и в
  `classifySpaceDrag`), `advanceFurniturePlacementPress` необратимо помечает
  `cancelled=true` (юнит-тест подтверждает «возврат в исходную точку остаётся
  pan» и граничное точное значение остаётся click). Mouse-press не ставит
  предмет сразу (`return false` — пропускает событие в общий pan), один
  click коммитит на `pointerup` через `_furnPlace`, проверка контекста
  (`_furnMouseCurrent`: mode/tool/space/palette/claim/capture) защищает от
  устаревшего триггера. Отмена: `pointercancel`→`_stagePointerCancel`→
  `_clearFurniturePreview` (сбрасывает и `_panStart`/`_panLock` для mouse-
  варианта); `blur`→`_onWindowBlur`; смена пространства
  (`_setSpaceId`)/disconnect/`Escape` (смена инструмента/символа) — все пути
  ведут к `_clearFurniturePreview()`. Правая кнопка исключена явно на входе
  `_decorPointerDown` (строка 3824). Геометрия/история пишутся только в
  `_furnPlace`, не во время pan.
- **UI-039** (`device-copy-editor.ts:69-91`): порядок пунктов меню —
  Открыть настройки / Копировать / Скрыть·Показывать на плане / Удалить —
  совпадает буквально. `active = !device.bindingStatus || kind==='active'`
  даёт true и для virtual, и для active; `disabled:!active` только на
  copy/visibility (settings/delete — штатные пути без привязки к
  bindingStatus). `ha_disabled/orphaned/unverified` → `active=false` →
  copy/visibility недоступны, сохранён текст объяснения
  (`device_inbox.show_disabled`, уже существующий ключ). `open()` отказывает
  при `current.hidden && !h._showAll` — меню не открывается для скрытого
  устройства, не показанного на плане.
- **UI-040** (`hp-confirm.ts`, `hp-dialog.ts:208,228,259`,
  `settings-dialogs.styles.ts:9,61,189`): `compact = key.startsWith(
  'remove-marker')` переключает `hp-dialog` в `ui-dialog`/`settings-layout`;
  общий `--hp-dialog-close-hover-transform: rotate(90deg) scale(1.12)` и
  `--hp-dialog-wide-width: 560px` задаются один раз в `hp-dialog.ts`,
  переиспользуются (не дублируются отдельным листом). `.btn{min-height:
  var(--hpf-action-height,44px)}`.
- **UI-041** (`device-face.ts:118-119`, `devices.styles.ts:98-110`):
  `hiddenDevice` имеет приоритет над `newDevice` в выборе класса
  (`newdot hiddendot` vs `newdot`), геометрия общая (`.newdot`), только
  `.hiddendot{background:#9e9e9e}` переопределяет цвет. Юнит-тест
  (`device-face.test.mjs:21-26`) явно проверяет «один `newdot hiddendot`»
  при `hiddenDevice:true` и обычный `newdot` без `hiddendot` при
  `newDevice:true,hiddenDevice:false`.
- **UI-042** (`space-order.ts:38-43`, `houseplan-card.ts:1592-1611`,
  `chrome.styles.ts:246-247`): `canStartTabDrag` — существующий механизм
  (#220) уже возвращает `false` при `mode==='view'` и при `spaceCount<=1`;
  `data-reorderable` переключает `cursor:grab`/`grabbing`. Подтверждено
  целевым смоком (`smoke_ui_lab_1081.mjs:76,89`): grab при
  нескольких пространствах в редакторах, pointer в View и при одном
  пространстве.
- **UI-043** (`demo/smoke_hidden_device_toggle.mjs:126-132`): целевая
  проверка `catalogDoesNotDuplicateHiddenChoice` (count чекбокса
  `.device-inbox-filter-help input[type=checkbox]` === 0) и сохранение
  состояния тулбара при открытии/закрытии каталога.
- **UI-044** (`live-viewport.ts:112-137, 212-243`,
  `houseplan-editor-runtime.ts:10831`, `houseplan-card.ts:11198`):
  `liveGridBounds` — ровно `x-0.25w,y-0.25h,1.5w×1.5h`, переиспользует
  существующий бюджет раскрытия сцены (`LIVE_SCENE_EXPOSURE_CLIP`,
  `needsViewBoxRefresh`); координаты grid-прямоугольника обновляются только
  при budget-рефреше (не на каждый rAft-кадр, без layout-чтений) — вместе с
  viewBox камеры. Юнит (`live-viewport.test.mjs:94`) закрепляет точные
  числа.
- **UI-045** (`settings-dialogs.styles.ts:77-78`): `border-radius:0` на
  `.hpf-callout`, кнопка `display:flex;width:fit-content;max-width:100%;
  margin-top:12px;white-space:normal` — отдельная строка, отступ 12px,
  перенос на узком экране.

### Защитные AC — таблица «чем краредеет»

`docs/design/1081-ui-lab/implementation-evidence/README.md` содержит раздел
«Protective contracts» с явным разделением исполненных отрицательных входов
(AC3, AC5, AC6, AC8/9, AC12 — обычные тесты с результатом) и
зарегистрированных, но не исполненных мутантов (AC2
`picker-exit-remains-interactive-1081`, AC4
`furniture-release-ignores-pan-1081`, AC10
`grid-loses-incoming-pixels-1081` — честно помечены «registered, not
executed»; AC11 — сырые парные образцы и бюджеты). Пустых третьих столбцов
нет; соответствует §2.7/#435. `mutation-gate.mjs --check` корректно описан
как статическая готовность (`execution=0, caught=unknown`), не как caught.

## Находки

Находок High/Medium по изменённым путям не выявлено. Замена пути
проверена отдельно (§7.2): старый painter контура группы декора и
дублирующий чекбокс/CSS/i18n-ключи каталога устройств удалены полностью
(grep не находит остатков); альтернативного пути измерения текстовых
границ не осталось, единственный владелец — `DecorGroupTextBoxes`.

Low (не блокирует, не требует отдельного цикла): в `houseplan-card.ts:
7078` и `:7151` `_editorRuntime._furnPointerMove(ev, …)` вызывается дважды
за одно и то же событие `pointermove`, когда курсор уже пересёк порог pan
(второй вызов происходит внутри `if (this._panLock==='pan' && stage)`).
Вызов идемпотентен (`advanceFurniturePlacementPress` монотонно выставляет
`cancelled`, `_furnPreviewInput` пересчитывается из того же `ev`), поэтому
наблюдаемого дефекта нет — это небольшая избыточность, не стоимость
сопровождения, которая оправдывала бы правку в этом цикле.

## Трейлеры и release-артефакты

- `release-ledger/v1.82.0/1081.json`: `category: stable-fix` с обоснованием
  относительно текущего stable v1.82.0 (полировка существующих редакторов,
  без новой схемы/поверхности); `visual` перечисляет кадры
  change/new с причиной каждого; смоки перечислены.
- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` содержат согласованные по
  смыслу записи «Unreleased» для #1081 (один факт — pan/click/grid/picker/
  menu/hidden-dot — не повторяется как два разных числа/источника).
- i18n: `device.settings` / `device.show_on_plan` / `device.hide` присутствуют
  во всех четырёх языках (`en`, `ru`, `de`, `fr` сверены) и совпадают по
  смыслу с меню.

## Что проверено и корректно

Все 13 пунктов контракта поведения разобраны по коду независимо (см. выше);
логика cancel/blur/lost-capture/смена пространства-инструмента-символа для
pending furniture placement — согласована и не оставляет повисшего
`_panStart`/`_furnTouchPending`. Матрица допустимости действий устройств по
`bindingStatus.kind` корректно отделяет virtual/active от
ha_disabled/orphaned/unverified, не подменяя HA binding status. Общие
стили подтверждения/picker переиспользуются, не дублируются отдельным
листом для каждого диалога. Сетка использует существующий бюджет раскрытия
сцены, не вводит отдельный perm rAF/layout read.

## Чего не проверял

Не выполнялся ручной GPU/реальный DPI прогон (не является гейтом ревью,
§7.1/#929: headless не объявляется GPU-проверкой, выполненные CDP/perf
замеры из хендоффа приняты как есть). Не перезапускал `gate:small`,
полный `smoke-select`, `pytest tests_backend`, golden-кадры и
performance-парные серии — они покрыты принятым `validate-gate` для
материала `b37e599f7cc4644b2b6daebc7fbe7c688234cb78` и не изменялись в этом
раунде; адресных пробелов, требующих нового `run_check`, не обнаружено,
поэтому `run_check` в этом раунде не вызывался. Не проверял физическое
touch/pen устройство (заявлено как best effort вне скоупа строгого
контракта, подтверждено `touch safety floor` в evidence, не является
частью приёмки этой задачи). Полная матрица тем/типов декора/устройств не
гонялась повторно — целевые кадры (light/dark/narrow) из ledger приняты как
представительная выборка, предрелизный гейт не дублируется здесь.

## Унаследовано

Раунд первый (r1) — раздела «Унаследовано из r<N-1>» нет.

## Маршрут

`mode=issues` (снимок политики сверен, расхождений нет). Побочных находок
вне скоупа нет — `outside_findings` пуст.

---

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0
→ в задаче · Документ: docs/reviews/CODE-REVIEW-1081-r1.md**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjUxYWE3Nzc5ZWZiMTQ3NGEzMjk4ODAwYTRkNTEyMTdlZjc0ZGI4MWU5ODgxNGZkZmRjYjAyYjg5YzE0MmU1YzYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxMGJjNzk0MGY3MGRhMzdhM2NlYTdhNmU2NjAxZWM3MzQ4ZjRkNTlmMGU4MjI1YWQ4YjM3MjBjNTAzZmI0OGNkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDgxLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJiMzdlNTk5ZjdjYzQ2NDRiMmI2ZGFlYmM3ZmJlN2M2ODgyMzRjYjc4IiwidHJlZSI6IjUyN2MzNTkxMzE4NjJhM2IxYzYzZTA4Y2UxYjk5MDZjMDE2ZmI3N2IiLCJib2R5RGlnZXN0IjoiNGY4NGU1ZTZmYjI3M2JkNTE2NWFhZmNmNGQ2YzI4OTNlZDhhZDcyODRiYTE1YTg0OWUyMDkxMTE0YjhmMmNjMyIsInByb2R1Y2VyUnVuIjoiNDAzNDIyNzMxOTAiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjQzNjU2ODI4OGMwODEzY2IwYWIwYmU0NTIzN2YxYmQxYmEzZmVhZjIxMjg4NzM0NTdjNGRiMmE5Y2ExNzExNzMiLCJ2ZXJkaWN0RGlnZXN0IjoiMGFlNDlhM2U5M2JjODY4ZTgwMmM5OTg5YWMxMmM4MjQwYTliMzg4M2E2NThhNTE2ODE4MDQwNmNkZmYwYzEwMCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJhZTViMjdmZjU0NmQyNjM0ZWQ0NDJiYTNlNGYxNGFjMmIyMzRmY2E4OGRmYjU5Yjc2ZTc1N2M2MTIzZTI3NGQ3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDE5MTQ5Mzk4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDgxI2lzc3VlY29tbWVudC02NDE5MTQ5Mzk4IiwiYm9keURpZ2VzdCI6IjdiYjM0MmQyNWFkMDI3OTBiOTQ2NTA3M2ZlZTg3ZmRjOGMyN2ZhNjI3YjVkMzdhMzcwM2RlYzNkOGE4N2E4MTMifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1081-ui-lab-accepted`, коммит `b37e599f7cc4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `527c359131862a3b1c63e08ce1b9906c016fb77b`
  ```
  git log --all --format='%H %T' | grep 527c35913186
  ```
- Тело issue: `4f84e5e6fb273bd5165aafcf4d6c2893ed8ad7284ba15a849e2091114b8f2cc3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40342273190,"run_attempt":1,"digest":"e6e86fc97e03ac563605e56d781be18b309c6898a40f9a525640ca2d94aaf695"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTU4LCJvdXRwdXRfdG9rZW5zIjo0MDYwNiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNzU3NDAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo5NzAxNTk1LCJjb3N0VXNkRXN0aW1hdGUiOjMuMDQ5NjU1fV0sInR1cm5zIjo5OCwiZHVyYXRpb25NcyI6NTIwNDEyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4wNDk2NTUsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=158 output_tokens=40606 cache_creation_input_tokens=175740 cache_read_input_tokens=9701595 num_turns=98 -->
