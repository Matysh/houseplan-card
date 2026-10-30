# CODE-REVIEW-1038-r1

Issue: #1038 · этап: code · трек: ask · заход r1 · блокирующих циклов 0/4
Материал: `db575ab129f2f3d79c7bbf45b174baceb3a732ef` (whole accepted dev
`c861d6150e3dbb01e03d2d65d7d825544eb3872b` включён слиянием), рабочая копия
уже на этом SHA. SPEC-REVIEW-1038-r2 зелёное (6379618210), решение владельца —
вариант B (6379397056). Ledger `docs/release-ledger/v1.82.0/1038.json`,
category `major`.

## Скоуп

Мультиселект декора в редакторе подложки: Ctrl+клик/Ctrl+A/Ctrl+M, совместное
жёсткое перемещение, общие цвет/прозрачность/обводка для однородного набора в
существующей Properties, атомарная история, две новые подсказки футера
(только Background). Обслуживает J4/J6 (`docs/SCOPE.md`): редактор — админский
инструмент, View не затронут. Диапазон диффа — 55 файлов, `+2183/-134`
(`git diff origin/dev...HEAD --stat`), 29 коммитов в `origin/dev..HEAD`.

## Как проверялось

Принятый `validate-gate` на материале `db575ab12`:
https://github.com/Matysh/houseplan-card/actions/runs/40134429911 —
review-light-golden proof complete. Беру его как покрытие полного
обязательного CI (39 named smokes + 2 group Golden + backend transfer +
static readiness) и не повторяю. Хендофф автора (issue comment 6389785955)
даёт таблицу AC → обычное доказательство → отрицательный свидетель для
AC1–AC7; ниже я перепроверил её чтением кода и тестов, не исполнением.

Прочитано целиком: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
тело issue (`## ТЗ`), все 22 комментария issue (включая оба SPEC-вердикта и
полную цепочку S6↔S7 возвратов), `docs/DECOR-EDITOR.md` (включая новый
раздел «Multiple selection»), diff `docs/USER-GUIDE.ru.md`/`CHANGELOG*`,
`docs/release-ledger/v1.82.0/1038.json`.

Риск по изменённым участкам, заданный пакетом (трек ask — сверка с AC ТЗ):

| Класс | Токен | Покрытие АС |
|---|---|---|
| touch | `surface.ts:162` pointerdown | Существующий guard на кнопке «вставить переменную»; изменение — только добавление `?disabled=` по матрице AC4 (text-поля целиком disabled при N>1). Не новый touch-контракт. |
| touch | `houseplan-editor-runtime.ts:3736,4035,4036` pointerType/PointerEvent | `_decorSnap`/`_decorGroupMove` переиспользуют существующую touch/pen-семантику магнита (px 14 vs 8); группа лишь передаёт `press.ids` как `excludeId`. Полная touch-паритетность явно не обещана ТЗ («Поддержка touch-редактора остаётся best effort»); обязательный safety-floor (Esc/pointercancel/второй контакт → полный откат) — раздел «Перемещение» ТЗ и AC3, проверено тестом `group.escape_restores_entire_begin` (строки 169–171 `smoke_decor_multiselect.mjs`) и pure-тестами отказа (`test/decor-group-edit.test.mjs`). Покрыто. |
| perf | `group-selection.ts:50` getComputedStyle | Частично покрыто — см. находку Medium ниже: сам факт измерения заявлен в разделе «План автотестов и производительности» ТЗ, но заявленное свойство («O(N выбранных) transform», «нет N-независимых … per frame») не выполняется именно этим путём, и единственный количественный perf-кейс AC7 (1000 записей) использует только `rect`, не проверяя text-decor вовсе. |

Адресно перечитан код (не только диф-контекст):
`src/editors/decor/{selection,group-edit,group-press,group-selection}.ts`
целиком; `src/editors/properties/{surface,editor,group-color-draft}.ts`
изменённые функции; `_decorPointerDown/_decorShapeDown/_decorMoveUpdate/
_dmUp/_decorGroupMove/_decorSelectionPressCurrent/_selectDecorShortcut/
_cancelDecorGesture` в `houseplan-editor-runtime.ts`; `measureHouseplanDecorText`
в `live-editor.ts`; `test/decor-group-edit.test.mjs`,
`test/properties-editor.test.mjs` (retirement/authority кейсы),
`demo/smoke_decor_multiselect.mjs` (выборочно — ключевые AC-сценарии).

Не прогонял заново: `npm run gate:small`, `tsc`, `npm run build`, полный
`npm test`, Golden acceptance, `pytest tests_backend`, performance-гейт —
всё это уже PASS на принятом proof (ссылка выше) и подтверждено хендоффом с
названными командами/результатами; новый SHA после ревью сам по себе не
отменяет это доказательство (§8). Не выполнял никаких ручных патчей
продукта/guard/лимита для получения отрицательного свидетеля (политика
мутантов) — для найденной ниже проблемы в «чем краснеет» названа команда
обычного прогона и зафиксировано, что она не нагружает этот путь.

## Находки

### Medium (в скоупе) — измерение текстового контура группы не O(N выбранных) и не покрыто perf-свидетелем на масштабе

`src/editors/decor/group-selection.ts:44-51` (`DecorGroupTextBoxes.measure`):

```ts
const elements = new Map([...root.querySelectorAll<SVGGraphicsElement>('text.dtext[data-id]')]
  .map(node => [node.getAttribute('data-id'), node]));
...
for (const shape of texts) {
  const element = elements.get(shape.id); if (!element) continue;
  const style = getComputedStyle(element);
```

`measureGroupText` (`src/editors/properties/editor.ts:729-731`) вызывается из
`measureHouseplanDecorText` (`src/live-editor.ts:426`), которая, в свою
очередь, вызывается из `_dtMeasure()` безусловно на каждом
`HouseplanCard.updated()` (`src/houseplan-card.ts:4361`: `if
(this._editorRuntime) this._dtMeasure();`) — то есть на любом ре-рендере
карточки, включая каждый `pointermove` активного группового перетаскивания
(`_decorGroupMove` зовёт `requestUpdate()` на каждое событие) и любой
hass-пуш состояния, пока в выделении есть хотя бы один объект типа `text`.

Для сравнения — существующий одиночный путь (`src/live-editor.ts:434`) берёт
элемент точечно: `renderRoot.querySelector('text.dtext[data-id="${shape.id}"]')`
— O(1) по выбранному id. Групповой путь вместо N точечных обращений строит
`Map` по **всем** `text.dtext[data-id]` в `root` на каждый вызов, то есть
стоимость растёт с общим числом текстовых объектов декора пространства, а не
с размером `N` выбранных — прямое расхождение с разделом ТЗ «План автотестов
и производительности»: «в move один resolver опоры и O(N выбранных)
transform… Нет N независимых magnet/geometry rebuild или transient записей
per frame».

**Чем доказан:** ничем на масштабе — AC7-перформанс-кейс
(`demo/smoke_decor_multiselect.mjs:309-317`, «1000 records») использует
исключительно `rect`-фигуры: `texts.length` в `measure()` для этого сценария
всегда 0, функция завершается на первой строке до `querySelectorAll`, и
данный путь при 1000 объектах вообще не исполняется.
**Чем краснеет:** обычный отрицательный свидетель отсутствует и не
зарегистрирован (в `scripts/mutation-registry.mjs` под `decorGroup1038Cases`
нет perf-кейса для этого метода — только корректностные: `decor-group-
text-outline-width-discarded-1038`, `decor-group-live-paint-only-leader-1038`
и т.д., все про геометрию контура, не про стоимость измерения).

Практический риск умеренный (типичный план едва ли содержит сотни текстовых
подписей, а однократный `querySelectorAll` на небольшом поддереве дёшев), но
заявление ТЗ о «не per-frame N-независимой перестройке» не выполняется для
этого конкретного пути и не верифицировано на масштабе, которым AC7 явно
оперирует для остальной геометрии. Нужно либо (a) сузить выборку до только
выбранных `texts` id (аналогично одиночному пути, N точечных `querySelector`
вместо одного `querySelectorAll` по всем текстовым фигурам), либо (b) добавить
в AC7 количественный кейс с text-декором в масштабе и явно принять измеренную
стоимость, как это сделано для веса бандла (issuecomment-6387520046).

### Low (снимаю, не блокирует)

`scripts/monolith-baseline.json` (не менялся в части `portMembers`: 368 до и
после #1038) расходится на единицу с числом, которое автор назвал в
финальном хендоффе (issue comment 6389785955: «Coupling: delegates 145 /
**portMembers 369** / hostRefs 6198 …»). Committed-артефакт (источник истины
для гейта `unused/coupling`) содержит 368, гейт PASS именно по нему — это
опечатка в тексте комментария, не в коде/бандле, и не нарушает «одно число —
один источник» для пользовательской видимой величины. Снимаю без правки.

## Что проверено и корректно

- **AC1** (идентификация набора, Ctrl+click/A/M, idle-поглощение вооружённых
  инструментов). Прочитаны `src/editors/decor/selection.ts` целиком —
  `decorSelectionMembers`/`toggleDecorSelectionId`/`allDecorSelectionIds`
  строго проверяют ID (дубликаты/пропуски/неоднозначность → `null`),
  подтверждено тестом `test/decor-group-edit.test.mjs` (первый `test(...)`,
  строки 16–28: `for(const selection of [['missing'],['l','missing'],['l','l'],
  [''],[1]])assert.equal(...,null)`). `_selectDecorShortcut`
  (`houseplan-editor-runtime.ts:4045-4055`) корректно исключает активный
  draft/line/contact/drag перед действием сочетания и использует существующий
  `beforeIntent`-guard. Негативная матрица idle/armed в
  `demo/smoke_decor_multiselect.mjs:118-139` (`group.idle.*`) проверяет
  отсутствие записи/истории и возврат в `select` для rect/ellipse/furniture
  на обоих сочетаниях.
- **AC2** (индивидуальные контуры, вариант B, без общей рамки/ручек).
  `renderDecorGroupOutlines` (`group-selection.ts:10-33`) рисует контур на
  каждого члена в `pointer-events:none` группе; smoke
  `group.no_group_handles`/`group.contours_are_inert` (строки 108-109)
  подтверждают отсутствие ручек и инертность. Golden `decor-multiselect-{light,
  dark}` сняты, PASS, просмотрены согласно хендоффу и принятому proof —
  повторно не смотрел (не изменившийся PNG/intent).
- **AC3** (жёсткое перемещение, одна история, отказ без clamp). Пакет pure-
  тестов `test/decor-group-edit.test.mjs` отдельно проверяет отказ на
  `Infinity/NaN/true/выход за границу` без частичного клампа одного члена
  («no member may be clamped while another moves», строки 46-53) и сохранение
  чужих/future-полей без алиасинга (`items===before` после мутации
  возвращённого результата). `_decorGroupMove`
  (`houseplan-editor-runtime.ts:4018-4040`) берёт один `press.items`-снэпшот на
  begin, считает один вектор через `_decorSnap(..., press.ids)` (все члены
  исключены из магнита — см. `excluded.has(shape.id)` в `_decorSnapGeometry`)
  и применяет его разом через `translateDecorSelection`. Esc/pointercancel —
  `group.escape_restores_entire_begin` (smoke, строки 169-171) и
  `_cancelDecorGesture` (строки 3759-3766: валидирует `_decorSelectionPressCurrent`
  перед восстановлением `before`).
- **AC4** (матрица полей по kind, независимые каналы, image только alpha).
  `decorGroupColorState`/`styleDecorSelection` в
  `test/decor-group-edit.test.mjs` (тесты «strict same-kind matrix»,
  «color-only/alpha-only», «image is alpha-only») точно повторяют таблицу
  ТЗ: rect/ellipse раздельные fill/stroke, line/text/furniture — одна пара,
  image — только alpha (`alphaOnly: kind==='image'`), и никогда не вводят
  несуществующий цвет (`Object.hasOwn(...,'color')===false`). Смешанный kind
  возвращает `homogeneousDecorKind(...) === null` → поля disabled
  (`group.mixed_kind.no_style_writer`, smoke строка 122).
- **AC5** (клавиатурные исключения, Line/draft сохранность, подсказки только
  в Background). `_selectDecorShortcut` проверяет `_pointers.size`,
  `_furnTouchPending`, `decorLine.active`, `_decorDraft`, `_decorMove`,
  `_dtDrag`, `backdropGesture.active` перед действием — соответствует «idle».
  Поглощение при активной цепочке Line проверено smoke
  `group.shortcut.active_line_preserved`/`active_line_continues` (строки
  288-296: anchor/draft сохраняются, следующий клик продолжает прежнюю
  линию). Подсказки футера — `surface.ts:187-189`, условие `port.decorShortcuts`
  равно `this.host._mode === 'decor'` (`editor.ts:690`), т.е. только Background;
  остальные редакторы не затронуты (grep подтверждает единственное место
  присвоения `decorShortcuts`).
- **AC6** (атомарность записи, authority/revision fences, без частичного
  commit). `test/properties-editor.test.mjs` — три целевых теста:
  «preparer, rejected prior queue and refused transport each restore the
  entire visible group with no accepted history» (строка 180), «retired held
  group cannot send, roll back a foreign body or release a newer authority
  handoff» (193), «same-content external revision retires selection…» (222);
  используют реальный `ConfigWriteContext`/`createConfigAdoption`, не заглушки
  поведения. `_decorSelectionPressCurrent` (`houseplan-editor-runtime.ts:4011-4015`)
  перед принятием результата проверяет mode/tool/canEdit/kiosk/space/adoption
  epoch/authority — именно то сочетание полей, которое ТЗ требует для отзыва
  pending callbacks.
- **AC7** (совместимость сохранения/reload, отсутствие постоянных групп,
  квота 1000). Backend `tests_backend/test_ha_decor_group_transfer.py` (102
  строки, 4 режима transfer) и `demo/smoke_decor_multiselect.mjs:309-335`
  (1000 rect-записей: один write, одна history-запись, полные записи без
  `group`/`selected` полей, cold-reload читает ровно сохранённое, без
  volatile selection/истории). Отсутствие новых API-вызовов —
  `group.no_new_api_writes`/`group.no_asset_requests` (строки 320-321).
  Бандл-бюджет обновлён и обоснован явным разрешением владельца
  (issuecomment-6387520046/6383329349), рамки/абсолютные пределы сохранены —
  не предмет этого ревью по существу (числовая авторизация владельца).
- **Трейлеры и changelog.** Все 29 коммитов `origin/dev..HEAD` несут `Issue:
  #1038`; все 4 коммита с `User-Visible: yes` (`66de9bb9f`, `c02e8864f`,
  `81afd9b98`, `7de1159a0`) в том же коммите правят и `docs/CHANGELOG.md`, и
  `docs/CHANGELOG.ru.md` (проверено построчно). Текст CHANGELOG не вводит
  пользовательских чисел, дублирующих источник, — «одно число — один
  источник» не нарушено.
- **Release-ledger.** `docs/release-ledger/v1.82.0/1038.json`: `category:
  "major"` обосновано относительно предыдущего stable (новая функция сверх
  singleton-редактора), `baseStable: v1.82.0` соответствует
  `docs/release-ledger/cycle.json` (уточнено автором в issuecomment-6381403816
  как исправление ошибочного `v1.83.0` в исходном тексте ТЗ — техническое
  решение, не продуктовое). `introducedBy` не требуется — это первичное
  добавление функции в этом бета-цикле, не правка уже выпущенной беты.
- **Документация.** `docs/DECOR-EDITOR.md` получил раздел «Multiple selection
  (#1038)», согласующийся с кодом (idle/armed/anchor семантика совпадает с
  `_selectDecorShortcut`/`_decorGroupMove`). `docs/USER-GUIDE.ru.md` использует
  термины из добавленных i18n-ключей (`decor.selection_count`,
  `decor.mixed_values`, `select_all`/`select_furniture`) — не изобретает новую
  терминологию.
- **Защитные AC-свидетели.** `scripts/mutation-registry.mjs` (`decorGroup1038Cases`,
  ~14 зарегистрированных id) и зафиксированное в хендоффе «Static readiness:
  …execution 0, caught unknown» согласуются с общей политикой — регистрация и
  статический PASS не выдаются за caught, поимка — только ночным прогоном;
  документ честно это разделяет.

## Чего не проверял

- Не перезапускал `npm run gate:small`, `tsc`, `npm run build`, Golden
  acceptance, `pytest tests_backend`, полный `npm test` — приняты как PASS по
  ссылке на `validate-gate` run 40134429911 и по детальному хендоффу с
  названными командами/результатами; материал не менялся после этого прогона
  в затрагивающей его части (ревью не меняет исполняемый код).
- Не выполнял ручную GPU/desktop-приёмку (headless Chromium не выдаётся за
  неё, и это не находка согласно REVIEWER.md).
- Не проверял исполнением фактический сценарий с двумя одновременными
  pointer-контактами (`pointerId`) на реальном multi-touch устройстве —
  `smoke_decor_multiselect.mjs` использует только `page.mouse`, без
  симуляции второго `pointerId`. Из чтения кода `_decorPointerDown`
  (строка 3861: второй `pointerdown` на пустом холсте с инструментом
  `select` вызывает `this.properties.clear()`, даже если `_decorMove` другого
  pointerId ещё активен) видно, что реальный перенос продолжается по
  собственному замкнутому `press.items`/`press.ids`, а не по текущему
  `properties`-состоянию, поэтому второй контакт не портит сохраняемые
  данные — но я не проверял это исполнением, только чтением; это не новая
  регрессия #1038 (тот же `properties.clear()` уже вызывался на wide-панели
  до этой задачи), и TOUCH-SUPPORT явно не обещает полную touch-модель
  мультиселекта, поэтому не поднимаю это до отдельной находки.
- Не пересчитывал вручную bundle/byte-бюджеты и line-count core — принял
  измеренные числа автора (`scripts/bundle-budget.mjs`,
  `scripts/monolith-baseline.json`) как согласованные с хендоффом (кроме
  отмеченного Low расхождения на 1 в `portMembers`).
- Не проверял английскую версию `docs/USER-GUIDE.md`/`CHANGELOG.md` построчно
  на стилистику — только наличие соответствующих правок и чисел.

## Маршрут и побочные находки

Маршрут вердикта: `fix` (трек ask — не `reclassify`).
Доверенный снимок `REVIEW_FINDINGS_POLICY`: `mode=issues`. Побочных находок
вне скоупа #1038 не обнаружено — всё найденное относится к собственному коду
задачи (единственная Medium выше, в скоупе, возвращается автору).

## Вердикт

Единственная находка — Medium, в скоупе, возвращается автору вместе с
документом; High нет. AC1–AC7 в остальном доказаны автотестами, способными
падать (проверено чтением тестов и заявленных негативных случаев), либо
разобраны чтением кода с указанием места. Трейлеры, changelog и ledger в
порядке.

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1038-decor-multiselect`, коммит `db575ab129f2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8f146476c69e1736da6f5ec452580875de9985d5`
  ```
  git log --all --format='%H %T' | grep 8f146476c69e
  ```
- Тело issue: `9a35afa1e36910604ad7382f0a83dd58c38a54bea1518eebc3d8e2b55189bded`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NjAsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDU1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTAsIm91dHB1dF90b2tlbnMiOjQ2NTkwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3OTUwOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjc0MTk5NDUsImNvc3RVc2RFc3RpbWF0ZSI6Mi42NjgxNDA5OTk5OTk5OTk0fV0sInR1cm5zIjo2OSwiZHVyYXRpb25NcyI6NTc1NzA1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi42NzMxOTU5OTk5OTk5OTk1LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5070 output_tokens=46609 cache_creation_input_tokens=179508 cache_read_input_tokens=7419945 num_turns=69 -->
