# CODE-REVIEW-645-r2

Issue: [#645](https://github.com/Matysh/houseplan-card/issues/645) — временное перетаскивание кнопки «Настройки комнаты» в редакторе плана.
Заход: r2 (код-ревью) · блокирующих циклов израсходовано 1 из 4.
Материал: `git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD`, вершина = `f293c6e9dc15edccc1b308f0bcc4f079b777f0b6` (рабочая копия уже на нём, `git fetch`/`checkout` не выполнялись).

## Дельта раунда

Предыдущий раунд (r1, документ `docs/reviews/CODE-REVIEW-645-r1.md`) разобрал задачу целиком на SHA `a8437e69` и вынес один Medium (M1). Между r1 и r2 добавлен ровно один продуктовый коммит:

- `f293c6e9` fix(editor): сохранять позицию кнопки при отмене Resize (#645) — `User-Visible: yes`, оба changelog правлены в этом же коммите.

`git diff a8437e69..f293c6e9 -- src/ test/ scripts/mutation-registry.mjs demo/smoke_resize_labels.mjs docs/` — единственная содержательная дельта (остальное в полном диффе — перегенерированный бандл `dist/`, `custom_components/houseplan/frontend/`, `docs/images/screenshots.json` с неизменными `imageSha256`, т.е. класс D без содержательных изменений):

- `src/room-gear-drag.ts` — новый метод `previewCenter()`: тот же `resolveRoomGearCenter`, но без побочного `this.positions.delete(key)`.
- `src/houseplan-editor-runtime.ts:3435` — `_rszEdgeLabels` (живая раскладка Resize) теперь зовёт `previewCenter` вместо `center` — ровно точка M1.
- `src/houseplan-editor-runtime.ts:10277-10285`, `src/houseplan-card.ts:12008` — `_renderRoomGear` получил параметр `preview: boolean` (`this._resize.dragging`) и во время активного resize-жеста тоже идёт через `previewCenter`, а не `center`.
- `scripts/mutation-registry.mjs` — существующий мутант `resize-label-uses-old-room-gear-centre` переточен на новый якорь `previewCenter`; добавлен новый мутант `room-gear-preview-prunes-session-position`, целящийся именно в удалённую строку `this.positions.delete(key)` внутри `previewCenter`.
- `test/room-gear-drag.test.mjs` — новый unit `#645 Resize preview cannot prune a session position that is valid after cancel`.
- `demo/smoke_resize_labels.mjs` — добавлены `previewKeepsMovedGear`/`cancelRestoresMovedGear`: временная точка вне preview-полигона не пропадает после `pointermove` и восстанавливается читаемой после `pointercancel`.
- `docs/CHANGELOG.md`/`.ru.md`, `docs/USER-GUIDE.md`/`.ru.md` — новая пользовательская формулировка («Cancelling a wall resize no longer resets that temporary position» / «Отмена изменения размера стены больше не сбрасывает это временное положение»).

Дельта локальна: один узкий resolver-путь плюс тесты/мутант/доки для него. AC, которые она задевает — AC8 (пруннинг недопустимой точки) и AC11 (Resize использует фактический центр) — разобраны заново ниже. Остальные AC1–AC7, AC9, AC10 дельту не пересекают (никакой их код не тронут) — приняты из r1 без повторной проверки, см. «Унаследовано из r1».

## Скоуп ревью

Не пересматриваю целиком: скоуп и продуктовая ценность (J6 `docs/SCOPE.md`) зафиксированы в r1 и этим коммитом не меняются — правка целиком внутри уже принятого периметра (`src/room-gear-drag.ts`, `src/houseplan-editor-runtime.ts`).

## Разбор находки M1

**Что было.** `_rszEdgeLabels` вызывал `RoomGearDragController.center()` с preview-полигоном активного (ещё не подтверждённого) Resize; `center()` безусловно удалял сохранённую позицию кнопки, если та не входила в транзитный кадр, — даже если финальная геометрия после `pointerup` снова сделала бы её допустимой.

**Чем закрыто.** `center()` разделён на два метода: `center()` (по-прежнему прунит — вызывается только с подтверждённой геометрией) и новый `previewCenter()` (`src/room-gear-drag.ts:207-214`) — тот же `resolveRoomGearCenter`, но без строки `this.positions.delete(key)`. `_rszEdgeLabels` (`src/houseplan-editor-runtime.ts:3435`) и рендер самой кнопки во время активного resize (`_renderRoomGear` с `preview=true`, `src/houseplan-editor-runtime.ts:10283`) теперь идут через `previewCenter`; коммит финальной геометрии в `_rszUp` (`src/houseplan-editor-runtime.ts:3299-3337`) и восстановление после `_rszCancelDrag`/`_rszPointerCancel` (`src/houseplan-editor-runtime.ts:3340-3371`) оба происходят уже после того, как `ResizeController.finish()`/`.cancel()` синхронно сбросили `dragging` в `false` — то есть следующий `requestUpdate()` рендерит кнопку через обычный `.center()` на уже подтверждённой (или восстановленной исходной) геометрии, где пруннинг снова работает как контракт п.11 требует.

**Воспроизведение (сам прогнал).**
- Unit `test/room-gear-drag.test.mjs`: `#645 Resize preview cannot prune a session position that is valid after cancel` — ставит `(9,9)` как сессионную позицию, преview-полигон делает её недопустимой; `previewCenter()` возвращает автоцентр, НО не трогает `this.positions` (`controller.positions.get(key)` остаётся `[9,9]`), обычный `center()` на исходном полигоне после этого по-прежнему возвращает `[9,9]`; отдельно тем же тестом подтверждено, что `center()` на подтверждённой (не preview) геометрии всё ещё прунит. Прогнал сам: `node --test --test-name-pattern="Resize preview cannot prune" test/room-gear-drag.test.mjs` — зелёный.
- Мутация (не просто «тест умеет падать», а конкретная снятая защита с результатом прогона): `node scripts/mutation-gate.mjs --id=room-gear-preview-prunes-session-position` — патч возвращает `previewCenter()` к вызову `this.center(...)` (то есть реинтродуцирует прунинг); чистый прогон таргетного теста зелёный, на мутанте тест краснеет («заявленный тест покраснел на мутанте», поймано 1 из 1). Аналогично `node scripts/mutation-gate.mjs --id=resize-label-uses-old-room-gear-centre` (якорь переточен на `previewCenter`, guard — `demo/smoke_resize_labels.mjs`) — чистый прогон зелёный, на мутанте красный, поймано 1 из 1.
- Browser smoke `demo/smoke_resize_labels.mjs` (собрал `npm run bundle:sync`, прогнал напрямую `node demo/smoke_resize_labels.mjs`) — `OK`; в частности новые поля `previewKeepsMovedGear` (позиция `[292,140]` цела сразу после `pointermove`, ужавшего комнату) и `cancelRestoresMovedGear` (та же позиция читаема после `pointercancel`) прошли через `checkAll()`, который равенством с `true` заваливает прогон на первом же `false`.

Всё это вместе — таблица «AC · чем доказан · чем краснеет» для этого раунда:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC8 (недопустимая точка сбрасывается **после подтверждённого** изменения, а не транзитного кадра) | Unit `#645 Resize preview cannot prune…`, последняя часть: `controller.center(room, preview)` после `previewCenter` всё ещё прунит | Мутант `room-gear-preview-prunes-session-position` (снимает `previewCenter`, возвращает пруннинг на транзитном кадре) — тест краснеет |
| AC11 (Resize использует фактический центр, preview не стирает валидную сессионную позицию) | `smoke_resize_labels.mjs`: `previewKeepsMovedGear`, `cancelRestoresMovedGear`, `movedGearDrivesResizePlacement` (последний не тронут дельтой) | Мутант `resize-label-uses-old-room-gear-centre` (откатывает `_rszEdgeLabels` на `poleOfInaccessibility`, игнорируя кнопку) — тест краснеет |

Регрессии AC8 в другую сторону (позиция не должна переживать ПОДТВЕРЖДЁННОЕ невалидное изменение) не возникло: та же дельта тестом и мутантом покрывает именно эту границу (последняя строка unit-теста выше).

## Побочный вопрос: `preview`-ветка в `_renderRoomGear`

`_renderRoomGear` (`src/houseplan-editor-runtime.ts:10277-10285`) теперь получает `preview: boolean = this._resize.dragging` и при `true` тоже зовёт `previewCenter`. Проверил чтением: полигон, который сюда попадает — `roomPoly(r)` из `r`, взятого из `space.rooms` внешнего рендер-цикла (`houseplan-card.ts:11181`), а `space` берётся из `this._spaceModel()` ⇢ `this._model` ⇢ `_serverCfg`. `_serverCfg.spaces[...].rooms` не мутируется во время активного (ещё не отпущенного) Resize — `_rszUp` пишет `sp.rooms = preview.sp.rooms` только по факту `pointerup`, `_rszMove`/`_rszAcceptPreview` трогают только кеш union стен, не сам конфиг. То есть полигон, который видит `_renderRoomGear`, на всём протяжении одного жеста Resize остаётся тем же самым (домрезайзовым) полигоном — с ним `center()` и `previewCenter()` в этой ветке дают одинаковый результат, пруннинг в `center()` тут физически не мог сработать иначе, чем на статичном полигоне до/после жеста. Другими словами: эта конкретная ветка расширения выглядит защитной/на будущее, а не фиксом наблюдаемого бага — но она безвредна (тот же чистый резолвер без побочных эффектов) и **фактически прогнана** тем же `requestUpdate()`-циклом, что и `_rszEdgeLabels` в smoke (полный ре-рендер лежит в том же `move()`), так что не завожу отдельной находки — Low, не блокирует, к правке не обязывает.

## Как проверялось (таблица гейтов)

| Гейт | Статус | Как |
|---|---|---|
| Validate (дешёвые гейты) на `f293c6e9` | зелёный, подтверждён ссылкой в задаче ревью (run 36107580771) | принят as-is по инструкции, не перегонял |
| `npx tsc --noEmit` | зелёный | прогнал сам |
| `npm test` | зелёный, 3070 passed / 1 skipped / 0 failed | прогнал сам (тестбилд собран `tsc -p tsconfig.test.json` + `scripts/fix-test-build.mjs` под капотом `npm test`). Автор в комментарии к issue заявил «3065 passed, 0 failed, 6 skipped» — расхождение с моим и с r1-прогоном (3069/1/0 на предыдущем SHA); не считаю это находкой — у меня зелёный прогон на точном материале ревью, причина расхождения похожа на другую платформу (Windows/WSL) у автора, не на нестабильность |
| `npm run build` + `bundle:sync` (сверка копий) | зелёный | прогнал сам; `git status`/`git diff --stat` после сборки по `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/` — пусто, три копии совпадают с закоммиченными |
| `node scripts/check-docs.mjs` | зелёный, «Documentation checks passed (7 files, 12 external links)» | прогнал сам (diff трогает `src/**`) |
| `node scripts/smoke-select.mjs --base a8437e69 --head f293c6e9` | прогнан | 16 прямых совпадений (символы `_resize`, `roomGear`, `roomPoly`, `SpaceModel`, `_editorRuntimeOrThrow`); разбор ниже |
| Все 16 «прямых совпадений»: `smoke_resize_labels`, `smoke_room_resize`, `smoke_bg_color`, `smoke_decor_layer_order`, `smoke_edit_walk`, `smoke_geometry_corpus`, `smoke_hide_layers`, `smoke_optional_space_model`, `smoke_pan_any_zoom`, `smoke_resize_audit_1550`, `smoke_resize_inner_dimensions`, `smoke_resize_outer_reconciliation`, `smoke_resize_wall_thickness`, `smoke_room_gear_drag`, `smoke_v8_draft_write`, `smoke_wallthick_standalone` | прогнаны все, все зелёные (`OK`) | список маленький (16 из 268), проще прогнать все, чем разбирать риск по каждому |
| Целевые мутанты `room-gear-preview-prunes-session-position`, `resize-label-uses-old-room-gear-centre` | прогнаны через `node scripts/mutation-gate.mjs --id=...` | оба: чистый прогон зелёный, мутант красит целевой тест — поймано 1 из 1 в обоих случаях |
| Целевой unit `#645 Resize preview cannot prune…` | зелёный, отдельно `--test-name-pattern` | часть `npm test` выше и отдельного прогона |
| `golden:verify` | не прогонялся | `docs/images/screenshots.json`: дифф меняет только `sourceFingerprint`/`sourceSha256` метаданные, ни одна строка `imageSha256` не в диффе (`git diff a8437e69..f293c6e9 -- docs/images/screenshots.json \| grep imageSha256` — 0 добавленных/удалённых строк) — idle-кадр не менялся, доказано сверкой хэшей, а не по умолчанию |
| `npm run invariants` | не прогонялся | дельта не трогает геометрическую модель (`roomPoly`, `pointInPolygon`, `poleOfInaccessibility` не менялись) — только резолвер сессионного UI-состояния поверх неё, как и в r1 |
| `pytest tests_backend` | не прогонялся | дельта не касается `custom_components/**/*.py` |
| performance-профили | не прогонялись | не названы в AC; дельта не меняет частоту/объём вычислений на кадр — тот же резолвер без нового `requestUpdate` |
| Оставшиеся 72 «слабых» связи `smoke-select` | не прогонял | слабая связь — сигнал посмотреть, не обязанность прогонять; дельта узкая и точечная, риск закрыт прямыми совпадениями |

## Что проверено и корректно

- Коммит `f293c6e9` несёт трейлеры `Issue: #645` и `User-Visible: yes`; `docs/CHANGELOG.md`/`.ru.md` правлены в этом же коммите (`git show --stat` подтверждает файлы в одном коммите).
- Терминология новой строки changelog/USER-GUIDE («temporary position», «предпросмотр изменения размера стены») согласована с уже принятой в r1 формулировкой, не изобретена заново.
- `_renderRoomGear`'s сигнатура (`preview: boolean`) — единственный вызывающий (`houseplan-card.ts:12008`) обновлён синхронно, `tsc --noEmit` подтверждает отсутствие расхождений типов.
- `previewCenter()` — чистая функция без побочных эффектов (делегирует в `resolveRoomGearCenter`, которая тоже не имеет side-effects — читал определение).
- Регрессия в обратную сторону (что `center()` на подтверждённой геометрии по-прежнему прунит недопустимую точку — исходное поведение AC8) — явно перепроверена тем же unit-тестом, не просто предположена.

## Чего не проверял

- Полный `golden:capture` — не требовался, см. таблицу (imageSha256 без изменений).
- 72 «слабых» связи `smoke-select` — не прогонял, решение см. в таблице гейтов.
- Полный ручной браузерный клавиатурный сценарий — вне AC этого раунда, дельта клавиатурной активации не касается.
- Повторный прогон Validate с полным реестром мутантов на `f293c6e9` — принят по ссылке в задаче ревью как есть; сам прогнал только два мутанта, относящихся к M1/этому диффу, а не весь реестр.
- Защитная ветка `preview` в `_renderRoomGear` (см. раздел выше) — проверена чтением и косвенно тем же smoke-циклом, не отдельным мутантом с прицелом именно на неё; вреда не несёт, поэтому не потребовал отдельного доказательства.

## Вердикт

M1 закрыт: защитный AC (пруннинг сессионной позиции только по подтверждённой геометрии) теперь доказан таблицей «чем доказан/чем краснеет» — юнит-тестом, который явно проверяет обе стороны границы, и двумя мутантами, оба пойманы при личном прогоне, а не по одной лишь записи автора. Browser smoke на изменённые строки — зелёный, прогнан лично. Новых High/Medium в этом раунде нет. Зелёный вердикт.

---

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, в скоупе) — Resize-preview безвозвратно стирает валидную временную позицию кнопки | `previewCenter()` заменил `center()` на transient-preview пути; `center()` со своим пруннингом остался только для подтверждённой геометрии | `src/room-gear-drag.ts:192-214`, `src/houseplan-editor-runtime.ts:3435,10283`; юнит `test/room-gear-drag.test.mjs:22-45`; мутант `room-gear-preview-prunes-session-position` в `scripts/mutation-registry.mjs`; smoke `previewKeepsMovedGear`/`cancelRestoresMovedGear` в `demo/smoke_resize_labels.mjs` |
| L1 (Low, снята без правки) — мёртвый `_gearPtCache` | Не тронуто в этом раунде — снятие без правки не обязывало к действию | `src/houseplan-card.ts:12003`, `src/houseplan-editor-runtime.ts:575` — поля по-прежнему объявлены и по-прежнему не читаются; статус не изменился с r1 |

## Унаследовано из r1

Без повторной проверки в этом раунде — дельта их не касается, код не менялся с r1:

- **AC1** (исходное положение, click/tap, Enter/Space) — `CODE-REVIEW-645-r1.md`, материал `a8437e69`.
- **AC2** (mouse drag освобождает элемент) — там же, smoke `smoke_room_gear_drag.mjs` (`freesCoveredPoint`, `dragUsesPlanCoordinates`).
- **AC3** (click ≠ drag) — там же, мутант `room-gear-drag-reopens-settings`.
- **AC4** (граница комнаты, вогнутый полигон) — там же, unit `test/room-gear-drag.test.mjs` (сегменты, не тронутые этим диффом).
- **AC5** (pan/zoom не сдвигают плановую точку) — там же, smoke `zoomKeepsPlanPosition`/`spaceSwitchKeepsPlanPosition`.
- **AC6** (cancel/multitouch) — там же, мутант `room-gear-second-touch-keeps-drag`.
- **AC7** (независимость комнат, персистентность, нет записи в конфиг/Undo) — там же, smoke `dragDoesNotWriteModel`.
- **AC9** (визуал/доступность) — там же, чтение `plan.styles.ts`.
- **AC10** (нет регрессий вне редактора) — там же, `smoke_editor_gestures.mjs`.
- Скоуп/продуктовая ценность (J6 `docs/SCOPE.md`), spec-review (жёлтый r1 → зелёный r2 на этапе spec) — не пересматривались, дельта их не касается.

---

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/645-room-settings-button-drag`, коммит `f293c6e9dc15` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fa806223893234de657ffdbde1d4f62a7b68bbb8`
  ```
  git log --all --format='%H %T' | grep fa8062238932
  ```
- Тело issue: `1cfefdd93db1946a31ecfd2bc15198fd49ae0e9031bd1b6b9751e50258aa0a46`
- Вердикт конвейера: `green` · High 0
