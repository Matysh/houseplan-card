# CODE-REVIEW-113-r1 — честный optional-контракт `_spaceModel()`

- **Issue:** https://github.com/Matysh/houseplan-card/issues/113
- **ТЗ:** `docs/specs/113-optional-space-model.md`, ревью ТЗ — `docs/reviews/SPEC-REVIEW-113-r1.md` (зелёный, Medium-1 → #184, не блокирует)
- **Диапазон:** `origin/dev..HEAD` = `5f02dd3` (docs: specify optional space model contract), `7660868` (docs: review document), `09b5a74` (Make empty space model explicit)
- **Коммит реализации:** `09b5a74e866a595138bd93703fd09a4860bf7757`
- **Цикл:** r1/4
- **Роль:** ревьюер кода (Claude), свежая сессия, без контекста реализации Codex

## 1. Скоуп

Единственный коммит класса A/B по существу — `09b5a74`. Он:

- меняет `_spaceModel(): SpaceModel` → `_spaceModel(): SpaceModel | undefined` и вводит
  `_spaceModelById(id): SpaceModel | undefined` (exact lookup, без first-space fallback);
- выносит чистые селекторы в новый файл `src/space-model-selection.ts`
  (`selectActiveSpaceModel`, `selectSpaceModelById`) с unit-тестами;
- классифицирует и правит все ~45+ производственных обращений к `_spaceModel()` по классам
  §5 ТЗ (lifecycle/render-гейт, event handlers редакторов, pure render helpers, paths с уже
  доказанным space);
- вводит `_syncEmptySpaceState()` — вызываемый из `willUpdate()` guard, который один раз на
  переход non-empty→empty снимает pointer capture, обрывает жесты/drag/pan/pinch/resize/vac-fit,
  закрывает draft/history/space-scoped диалоги, отменяет debounced config write и возвращает
  `_mode` в `'view'`; повторно вооружается при следующем appearance/disappearance цикле;
  добавляет `Debounced.cancel()`;
- добавляет `demo/smoke_optional_space_model.mjs`, `test/space-model-selection.test.mjs`,
  `test/optional-space-model-contract.test.mjs`, мутационный guard
  `empty-space-cleanup-disabled` в `scripts/mutation-gate.mjs`;
- документирует инвариант в `docs/ARCHITECTURE.md` и добавляет чек-лист в `docs/TESTING.md`.

`User-Visible: no` — согласовано с владельцем на этапе ТЗ (§13 спецификации): видимое поведение
при существующих пространствах не меняется (гейт `render()` на `model.length === 0` уже отделял
пустой план от общего пути, старый код уже безопасно работал по факту порядка вызовов). Изменение
устраняет класс латентных крашей (#111 повторно), не новую пользовательскую возможность.
Соответствует, обе changelog-правки в этом коммите отсутствуют обоснованно.

Medium-1 из ревью ТЗ (#184, fallback-семантика §6 для явного `id`) вынесен отдельным issue,
не расширяет #113; ниже проверено, что реализация фактически перевела все стабильные-id call
sites на exact lookup (сильнее, чем требовало формально необязательное AC8) — см. §4.

## 2. Как проверялось — таблица гейтов

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | OK, без ошибок |
| Unit | `npm test` | `811/811` — совпадает с заявленным в хендоффе и с `npm run inventory` |
| Build + 3 копии бандла | `npm run build` затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | OK, обе сверки — байт-в-байт совпадение |
| Именованный smoke (AC3–AC6) | `node demo/smoke_optional_space_model.mjs` | OK, все 9 подпроверок `true` |
| Именованный smoke (AC6, read-only cold start) | `node demo/smoke_readonly_cold_start.mjs` | OK, все 13 подпроверок `true` |
| Мутационный guard AC10/AC4/AC5 | `node scripts/mutation-gate.mjs --id=empty-space-cleanup-disabled` | `поймано 1 из 1` — чистый прогон зелёный, мутант (`if (empty) return;` вместо `if (this._emptySpaceStateActive) return;`) красит смок, т.е. тест **умеет падать** |
| Регрессия непустого пути (поверхности: markers/positions, wall-thickness, free walls/columns, opening preview, open/close wall, isometric contract, merge/split, vacuum fit, corner split, draw-wall thickness) | `node demo/smoke_marker_stay.mjs`, `smoke_wall_thickness.mjs`, `smoke_free_walls.mjs`, `smoke_opening_preview.mjs`, `smoke_openwall.mjs`, `smoke_isometric_contract.mjs`, `smoke_merge_split.mjs`, `smoke_vacuum.mjs`, `smoke_split_corner_wall.mjs`, `smoke_draw_wall_thickness.mjs` | OK, все 10 зелёные |
| Process gate | `node scripts/process-gate.mjs --issues` | `гейт пройден, предупреждений 0` |

**Не прогонялось, и почему:**

- **Полный набор из 135 браузерных смоков** — diff трогает десятки геометрических хелперов
  (`_frameOf`, `_isoScene`, wall/opening/decor/room helpers), но во всех них новый код — это
  *guard, добавленный до* существующей логики, срабатывающий только при `model.length === 0`.
  При непустой модели `_spaceModel()` = `models.find(...) ?? models[0]`, что при непустом массиве
  никогда не даёт `undefined` — путь `if (!space) return …` в каждом таком месте логически
  недостижим для непустого плана (проверено чтением, не исполнением, во всех местах диффа).
  Прогнан репрезентативный набор из 10 смоков по каждой тронутой геометрической поверхности
  (таблица выше) — все зелёные, что подтверждает отсутствие регрессии на практике, а не только
  по рассуждению. Прогон всех 135 не добавил бы информации, пропорционально задаче не прогонялся
  (PROCESS §8).
- **`npm run golden:verify`** — не прогонялся. По той же причине (недостижимость нового кода
  при непустой модели, подтверждённая чтением `render()`: `if (!model.length) return html\`…\`;`
  идёт раньше `const space = this._spaceModel(); if (!space) return nothing;`, и второй `return`
  математически недостижим, когда `model.length > 0`) видимый результат при непустом плане не
  меняется; для пустого плана экран тот же самый JSX-блок, что и раньше диффа (не тронут).
  Пиксельного риска нет, golden не запускался осознанно, а не пропущен по умолчанию.
- **`python -m pytest tests_backend`** — не тронут ни один файл `custom_components/**/*.py`,
  бэкенд не запускался.
- **Performance-профили** — ни в AC, ни в диффе не затронут ни один hot render path кроме
  добавления O(1)-проверок в начале функций и одного one-shot `querySelectorAll('*')`,
  срабатывающего не на каждый рендер, а один раз на реальный переход в пустой план (проверено
  чтением `_syncEmptySpaceState`/`willUpdate`). Не прогонялись.
- Оставшиеся ~120 смоков вне таблицы (isometric-live-touch и т.п. поверхности, которые дифф не
  трогает напрямую) — не прогонялись; сознательное решение, а не молчаливый пропуск.

## 3. Проверка AC (docs/specs/113-optional-space-model.md §10)

| AC | Доказательство | Статус |
|---|---|---|
| AC1 optional тип у `_spaceModel`/exact варианта | `npx tsc --noEmit` зелёный при сигнатуре `SpaceModel \| undefined`; `test/optional-space-model-contract.test.mjs` проверяет regex-ом наличие точной сигнатуры обоих методов | доказано unit-тестом, тест умеет падать (см. §4) |
| AC2 все production call sites без non-null assertions | тот же contract-test: `assert.doesNotMatch(source, /this\._spaceModel\(\)\s*!/ …)` плюс запрет наготовой `.` без `?.`/guard | доказано unit-тестом, экспериментально подтверждена ловля регрессии (см. §4) |
| AC3 empty render/update/resize/theme/WS не бросают исключений | `smoke_optional_space_model.mjs`: `deleteLastRendersEmpty`, `wsEmptyAbortsLiveGesture`, `emptySurvivesThemeResizeReadonly` — все `true`, без падения страницы | доказано браузерным smoke (исполнение) |
| AC4 удаление последнего space оставляет рабочий empty-state | `deleteLastRendersEmpty`, `createFlowSurvivesEmpty` | доказано smoke |
| AC5 pending pointer/drag/editor action abort без history/persist/service call | `deleteLastAbortsEditorState`, `deleteLastCancelsPendingWrite`; проверено чтением, что `_drag`/`_pointers` очищаются **до** какого-либо `pointerup`-коммита (коммит живёт в up-хендлерах, которые физически не вызываются после очистки состояния) | смок + чтение кода up-хендлеров |
| AC6 read-only cold start с `spaces: []` стабилен | `emptySurvivesThemeResizeReadonly` (в `smoke_optional_space_model.mjs`, `_serverCanWrite=false`) + `smoke_readonly_cold_start.mjs` (непустой read-only путь, не регрессировал) | доказано smoke |
| AC7 non-empty View/editors — pixels/actions без изменений | логически недостижимый guard (см. §2) + 10 регрессионных smoke по тронутым поверхностям, все зелёные | проверено чтением + smoke, golden сознательно не прогонялся (см. §2) |
| AC8 missing explicit stale id не мутирует первый space | `test/space-model-selection.test.mjs`: `selectSpaceModelById(spaces, 'stale') === undefined`; `optional-space-model-contract.test.mjs` проверяет, что `_livePos`, `_vacPlanRoomAnchors`, `_vacStartFit`, `_labelMove`, `_rlResizeMove` используют `_spaceModelById`; лично сверено чтением, что все явные call sites (`_livePos`, `_vacPlanRoomAnchors`, `_vacStartFit`, `_labelMove`, `_rlResizeMove`, `_saveMarker`'s `targetSpaceModel`) действительно вызывают `_spaceModelById`, а не `_spaceModel(id)` (метод с параметром `id` больше не существует) | доказано unit-тестом + подтверждено чтением исходника |
| AC9 active-id fallback при непустой модели сохраняет legacy behavior | `test/space-model-selection.test.mjs`: `selectActiveSpaceModel(spaces, 'stale') === spaces[0]`, `selectActiveSpaceModel(spaces, null) === spaces[0]` | доказано unit-тестом |
| AC10 type/source gates не пускают прежнюю ложную сигнатуру | `node scripts/mutation-gate.mjs --id=empty-space-cleanup-disabled` → `поймано 1 из 1`; отдельно вручную подтверждено, что regex контракт-теста ловит намеренно испорченный naked-deref (см. §4) | доказано мутационным тестом (исполнение) |

## 4. Дисциплина «тест умеет падать» — что лично проверено исполнением

- **Мутационный гейт**: `node scripts/mutation-gate.mjs --id=empty-space-cleanup-disabled`
  фактически применяет патч (`if (this._emptySpaceStateActive) return;` →
  `if (empty) return;`), пересобирает и гоняет `smoke_optional_space_model.mjs` — результат
  `тест покраснел, как обязан`. Не «предположительно ловит», а подтверждённая красная реакция.
- **Source-contract regex**: собран мутированный в памяти текст (без изменения репозитория) с
  заменой `this._spaceModel()?.bg` → `this._spaceModel().bg` и прогнан ровно тем же regex, что
  использует `optional-space-model-contract.test.mjs`
  (`/this\._spaceModel\(\)\s*\./`) — совпадение `true`, то есть тест обязательно упадёт при
  возврате naked-deref. Проверка выполнена вживую через `node -e`, не только прочитана.

## 5. Находки

Нет находок High. Нет находок Medium.

**Low-1** (не блокирует, не требует правки — оставлено с записью). `_syncEmptySpaceState()` не
сбрасывает `_splitSel`, `_mergeDialog`, `_wallDialog` при переходе в пустой план (ТЗ §7
перечисляет конкретный список, и эти три в него не входят напрямую). Разобрано чтением: все три
рендерятся только внутри ветки `render()` после `if (!model.length) return …` и
`if (!space) return nothing;`, то есть при пустом плане не видны; `_splitClick`/аналоги уже
содержат защитный код на случай "roomId не найден в моделе" (строки ~11239–11244), который
сработает безопасно, если пользователь пересоздаст план с другими id комнат и продолжит с
залипшим `_splitSel`. Наблюдение косметическое (не входит ни в один пользовательский сценарий из
ТЗ, не даёт сбоя) — снимаю без issue.

**Low-2** (не блокирует). `render()`'s `if (!space) return nothing;` (после
`const space = this._spaceModel();` в непустой ветке) недостижим при `model.length > 0` — то же
верно и для нескольких других мест диффа (см. §2/AC7). Это защитный код на случай будущего
разъединения инварианта «модель непуста ⇒ активный space существует», не дефект; TS не может
доказать эту связь сам, так что явная проверка оправдана как type-safety, а не как признак
недоделки. Отмечено, правки не требуется.

## 6. Что проверено и корректно

- `_model` (геттер) строится через `spaceModels(cfg).map(...)` 1:1 по `cfg.spaces`, без
  фильтрации записей; `_renderCfg` сохраняет длину `spaces` (заменяет только контент одного
  элемента при активном resize-preview). Значит проверка `_syncEmptySpaceState` на
  `this._serverCfg.spaces.length === 0` и проверка `render()` на `this._model.length === 0`
  наблюдают одно и то же состояние — не расходятся (прочитано `_buildModel`, `spaceModels`,
  `_renderCfg`).
- `_syncEmptySpaceState()` вызывается из `willUpdate()` **до** `_captureRenderDeviceSnapshot()`
  на каждом обновлении (не только при смене `_serverCfg`), но благодаря флагу
  `_emptySpaceStateActive` весь путь очистки — не более двух проверок свойств при непустой
  модели; повторный вход в пустое состояние (после пересоздания и нового WS-опустошения) снова
  срабатывает — подтверждено вторым циклом внутри самого smoke.
- Все guard'ы в event-хендлерах редакторов (`_physicalDown`, `_openingClick`, `_opPointerDown`,
  `_physicalRotateDown`, `_savePhysicalDialog`, `_commitMerge`, `_commitRoom`, `_saveMarker` и
  далее по диффу) расположены **до** `stopPropagation`/`capturePointer`/мутации диалога —
  соответствует ТЗ §5.2 «guard до side effects». Проверено построчным чтением каждого изменённого
  метода в диффе, не выборочно.
- `_saveMarker` — самая тяжёлая перестройка диффа: `targetSpaceModel` (через
  `_spaceModelById(explicitSpaceId)` либо активный `_spaceModel()`) вычисляется и проверяется
  (`if (!targetSpaceModel) return;`) до `this._markerDialog = { ...dlg, busy: true }` — то есть до
  первого наблюдаемого побочного эффекта транзакции. Старый код вместо этого читал
  `this._spaceModel(space || undefined).vb` внутри `try`, что при пустой модели тип обещал
  безопасным, а исполнение — падало; теперь путь физически не достижим без валидной модели.
- `_isoSource`/`_isoScene`/`_frameOf` — все места, где сигнатура стала `| null`, имеют парный
  `if (!x) return …` у каждого вызывающего (7 точек использования `_isoScene()` в файле,
  проверены все, не выборочно).
- `npx tsc --noEmit` зелёный — это, в частности, доказывает, что каждый параметр, куда
  «доказанный» `SpaceModel` передаётся вниз по вызовам (§5.4 ТЗ), действительно набран нешироким
  (не `| undefined`) типом на входе — компилятор не пропустил бы несовпадение, обходов через `any`
  в диффе не найдено при чтении.
- Коммит `09b5a74` несёт `Issue: #113` и `User-Visible: no`; изменений в `docs/CHANGELOG*.md` нет
  и не требуется. `docs/ARCHITECTURE.md`/`docs/TESTING.md` обновлены в том же коммите.
- `node scripts/process-gate.mjs --issues` зелёный на этом диапазоне.

## 7. Чего не проверял

- Полный браузерный набор (135 смоков) и `golden:verify` — обоснование сужения в §2.
- `pytest tests_backend` — класс A/B бэкенда не тронут.
- Performance-профили — не названы в AC, hot-path не тронут (обоснование в §2).
- Не проверялось поведение при повреждённой модели с дублирующимися id (явно вне скоупа, ТЗ §3).
- Не перепроверял Medium-1/#184 по существу — это отдельный issue, не в диапазоне этого код-ревью.

## 8. Вердикт

Все AC1–AC10 доказаны — либо исполняемым тестом с подтверждённой способностью упасть (unit,
browser smoke, mutation gate), либо явной записью «проверено чтением, не исполнением» с указанием
конкретных строк/инвариантов. High: 0. Medium: 0. Two Low observations waived with a note, no new
issue required.

**Вердикт: зелёный · цикл r1/4 · High: 0 · Medium: 0 → нет · Документ: docs/reviews/CODE-REVIEW-113-r1.md**
