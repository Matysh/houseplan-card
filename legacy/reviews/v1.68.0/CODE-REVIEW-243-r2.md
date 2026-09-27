# CODE-REVIEW-243-r2

- Issue: [#243](https://github.com/Matysh/houseplan-card/issues/243) — «Перетаскивание вкладок пространств не работает: захват указателя съедает
  цель. Плюс нужен указатель места вставки»
- Этап: code (PROCESS.md §2.7)
- Заход: r2 · блокирующих циклов израсходовано 0 из 4 (r1 был зелёным и бюджет не тратил, §7.2, #227)
- ТЗ: `docs/specs/243-space-tab-drop-target.md` (`7ac1934`, не менялся с r1), SPEC-REVIEW: `docs/reviews/SPEC-REVIEW-243-r1.md`, вердикт зелёный
- Диапазон этого раунда: `origin/dev...HEAD` (`origin/dev` = `56a3977`, дальше не двигался), 5 коммитов:
  - `133fdc9` `docs(spec): define reliable space tab drop target` (класс C, `Issue: #243`, `User-Visible: no`)
  - `02a5230` `docs: review document for #243` (класс C, SPEC-REVIEW документ)
  - `e6ac033` `fix(tabs): restore captured mouse reordering` (класс A/B/C/D, `Issue: #243`, `User-Visible: yes`) — единственный коммит с продуктовым поведением
  - `0fa7c28` `docs: review document for #243` (класс C, CODE-REVIEW-243-r1 документ)
  - `e4fe502` `docs: accept screenshot fingerprint for #243` (класс C, `Issue: #243`, `User-Visible: no`)
- Ревьюер этого раунда не имеет контекста реализации; материал — диапазон коммитов и diff, не рассказ автора.

## Почему это r2, а не продолжение r1

Вердикт r1 (комментарий `2026-08-22T16:39:51Z`, документ `docs/reviews/CODE-REVIEW-243-r1.md`) был
**зелёным, 0 находок**, получен на implementation-коммите `f4de527`. SHA в том вердикте назван
прямо в тексте документа — это не находка данного раунда.

После зелёного ревью слияние в `dev` конфликтовало (`docs/images/screenshots.json`). Владелец
вернул issue в `S6-in-progress` только для ребейза (комментарий `2026-08-22T16:40:03Z`), без
указания на дефект кода. Автор перебазировал ветку на `origin/dev` `56a3977`; implementation-коммит
получил новый SHA `e6ac033`, добавился разрешающий конфликт коммит `e4fe502` (принятие нового
screenshot-фингерпринта из канонического CI-прогона).

**Разбор в этом раунде полный, не по дельте** — по прямому указанию PROCESS.md §2.10 и AGENTS.md:
«после ребейза на ушедший вперёд `dev` это другой код», а не редактирование по замечанию. Диапазон
`origin/dev...HEAD` целиком (все 5 коммитов) — предмет разбора, включая diff, который r1 уже видел
под другим SHA, и диапазон, который r1 не видел вовсе (`e4fe502`).

## Скоуп ревью

Изменённые файлы продуктового/тестового кода (коммит `e6ac033`, единственный с поведением):

```
src/houseplan-card.ts             78 +++--   pointer-move на .tabs, координатный hit-test,
                                              suppress-click, _endTabDrag() в _pickSpace/_setMode
src/styles.ts                      3 +-      drop-before / drop-after вместо .droptarget
demo/smoke_space_tab_reorder.mjs 497 (переписан на трастед page.mouse)
demo/golden/harness.mjs           68 ++      семантический guard для tabDrag-сцен
demo/golden/matrix.mjs             8 +-      2 новые сцены, версия матрицы 35 → 36
demo/golden/run.mjs                7 ++      release мыши в finally
scripts/mutation-gate.mjs         48 ++      3 новых мутанта + правка tab-drag-outlives-the-card
test/golden-matrix.test.mjs       23 ++      unit-контракт двух новых сцен
docs/CHANGELOG.md/.ru.md, docs/USER-GUIDE.md/.ru.md, docs/TESTING.md — в том же коммите
```

Плюс отдельным коммитом `e4fe502`: только `docs/images/screenshots.json` (source/имиджные хэши
скриншотов), со ссылкой на канонический прогон
[Docs screenshots](https://github.com/Matysh/houseplan-card/actions/runs/32585516781).

## Как проверялось

1. Прочитан `docs/SCOPE.md` — задача чинит регрессию выпущенной функции J6 («keep the plan true as
   the home evolves»), персона home admin, поверхность desktop-редакторы; новый разделитель делает
   уже принятый контракт #220 честным, мандат не расширяет.
2. Прочитаны `AGENTS.md` и `PROCESS.md` целиком, включая §2.10 (объём повторного раунда), §7.2
   (ребейз — другой код), §4 (лимит циклов), §8 (соразмерность гейтов), §12.
3. Прочитано тело issue #243 и все комментарии, включая обе реплики автора о ребейзе и оба
   предыдущих вердикта ревьюера (SPEC-REVIEW r1 и CODE-REVIEW r1).
4. Прочитан ТЗ `docs/specs/243-space-tab-drop-target.md` целиком (не менялся с r1) и сверен построчно
   с текущим diff по каждому разделу — контракт hit-testing §7, контракт завершения §8, визуальный
   контракт §9, AC1–AC9 §12.
5. Прочитан `docs/USER-GUIDE.ru.md`/`.md` — формулировка про разделитель и сторону вставки согласована
   с текстом ТЗ, терминология не изобретена.
6. Построчно прочитан **весь** diff `src/houseplan-card.ts` (не только «что изменилось с r1», а весь
   diff `origin/dev...HEAD`, поскольку это разбор с нуля): `_tabPointerDown`, новый `_tabDropTargetAt`,
   переписанные `_tabPointerMove`/`_tabPointerUp`, новый `_suppressNextTabClick`/`_tabSuppressClickTimer`,
   вызовы `_endTabDrag()` в `_pickSpace`/`_setMode`/`disconnectedCallback`, изменение шаблона рендера
   (`@pointermove` на контейнере `.tabs`, классы `drop-before`/`drop-after`).
7. Самостоятельно (не со слов автора и не со слов r1) прослежена семантика двойной доставки
   `pointerup`: захват указателя ретаргетирует `pointerup`/совместимые mouse-события на исходную
   вкладку независимо от того, где физически отпущена кнопка; локальный `@pointerup` на исходной
   вкладке срабатывает раньше, чем событие всплывает до `window`, и синхронно снимает оконный
   листенер внутри `_endTabDrag()` до того, как всплытие туда дойдёт — поэтому `_commitTabOrder`
   вызывается не более одного раза на один физический `pointerup`. Оконный листенер остаётся
   единственным путём для случаев, когда локальный слушатель не сработал бы (потеря capture браузером).
8. Самостоятельно вручную прогнана математика `reorderSpaceIds` (`src/space-order.ts:55-65`, диффом
   не тронут) на обоих направлениях переноса и сверена со знаком `placement` из `_tabDropTargetAt`:
   перенос влево (`targetIndex < sourceIndex`) даёt `before` и `splice` действительно ставит
   перетаскиваемую вкладку перед целью; перенос вправо даёт `after` и ставит её после — соответствует
   §7.3 ТЗ.
9. Прочитан diff `src/styles.ts` — `drop-before`/`drop-after`, `inset` box-shadow с разным знаком,
   один theme token — соответствует §9 ТЗ.
10. Прочитан diff `demo/smoke_space_tab_reorder.mjs` целиком (497 строк): все позитивные сценарии
    (AC1–AC4, включая негативный на View в строках 279–295) используют `page.mouse`; синтетический
    `dispatchEvent` остался только в двух местах — явный `pointercancel` (AC5, строка 228) и явная
    ветка `pointerType: 'touch'` (AC6, строка 271) — как и требует ТЗ §13.1.
11. Прочитан diff `demo/golden/harness.mjs`/`matrix.mjs`/`run.mjs`, `test/golden-matrix.test.mjs`.
12. Прочитан diff `scripts/mutation-gate.mjs` — три новых мутанта, плюс адаптация `find`/`replace` в
    `tab-drag-outlives-the-card` под новый порядок строк (`_endTabDrag(); clearTimeout(...)`),
    появившийся из-за `_tabSuppressClickTimer`.
13. Прочитан diff `docs/images/screenshots.json` (коммит `e4fe502`) — только смена `sourceFingerprint`
    и по одному `sourceSha256` на сцену; `imageSha256` не изменились ни у одной сцены (0 переснятых
    PNG), коммит содержит ссылку на прогон канонической Docs screenshots джобы.
14. Прочитаны трейлеры всех пяти коммитов и структура `e6ac033` (единственного user-visible) —
    оба changelog, оба USER-GUIDE, TESTING.md в одном коммите с поведением.
15. Прогнаны гейты лично (раздел ниже), не со слов автора и не переиспользуя цифры документа r1.

## Гейты — что прогнано и почему

Обязательные всегда (PROCESS.md §8, §2.10 — дешёвые гейты гоняются в каждом раунде):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Unit | `npm test` | PASS — 1091 tests, 1091 pass, 0 fail |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | PASS, обе копии идентичны dist |
| Docs fingerprint | `node scripts/check-docs.mjs` (обязателен, diff трогает `src/**`) | PASS — «Documentation checks passed (7 files, 10 external links)» |

По необходимости, определяемой diff/AC:

| Гейт | Команда | Результат | Почему прогнан |
|---|---|---|---|
| Smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Прямое совпадение: `smoke_space_tab_reorder`. Слабая связь по общему `_model` (10 смоков) | Обязателен для решения по выборке; вывод не изменился после ребейза |
| Целевой browser smoke | `node demo/smoke_space_tab_reorder.mjs` | OK, все 37 полей `true` | Прямое совпадение из smoke-select, AC1–AC6 |
| Mutation-gate, новые id | `node scripts/mutation-gate.mjs --id=tab-drag-target-follows-captured-source` (и остальные два новых id по отдельности через `--check`, см. ниже) | Пойманы | Доказательство «тест умеет падать» для AC1/AC2/AC4 |
| Mutation-gate, полный реестр | `node scripts/mutation-gate.mjs --check` | Все мутанты «ok», включая три новых (`tab-drag-target-follows-captured-source`, `tab-drop-indicator-always-before`, `tab-drop-outside-commits-last-target`) и адаптированный `tab-drag-outlives-the-card` | Проверяет, что адаптация мутанта под новый порядок строк в `disconnectedCallback` не потеряла покрытие regression-риска #220 |
| Golden verify (целевые сцены) | `npm run golden:verify -- --only=space-tab-drop-before-light,space-tab-drop-after-dark` (флаг `--only` не ограничивает вывод — прогоняется весь набор) | Обе новые сцены: `missing-baseline`, не `error`; в `artifacts/golden/golden-report.json` лично прочитан `runtime.tabDrag` каждой сцены: `ok: true`, `trusted: true`, правильные `sourceId`/`targetId`/`placement`, `insetX` положительный для `before` (`1.14858`) и отрицательный для `after` (`-1.14935`) | AC2/AC8 требуют доказательства семантического guard на реальном `page.mouse`-жесте; проверено не по факту статуса `missing-baseline`, а по содержимому отчёта |
| Слабые связи smoke-select (по теме diff) | `node demo/smoke_fixed_floor.mjs`, `node demo/smoke_space_card.mjs`, `node demo/smoke_deeplink.mjs`, `node demo/smoke_kiosk_pan_lock.mjs` | Все PASS/OK | fixedFloor/навигация вкладок задеты AC6; `_pickSpace`/`_setMode` получили новый вызов `_endTabDrag()` |
| Дополнительно по теме diff (не из smoke-select) | `node demo/smoke_modes.mjs` | OK | `_setMode` — новая точка вызова `_endTabDrag()` в этом diff; смок не помечен smoke-select (нет прямого совпадения по идентификатору), но напрямую упражняет изменённый путь |
| Process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD` | «гейт пройден, предупреждений 0», 5 коммитов | Дешёвый офлайн-гейт: трейлеры/класс файлов/ветка на весь диапазон раунда |

**Не прогонялось и почему:**

- `smoke_audit_1490`, `smoke_glow_blending`, `smoke_render_perf`, `smoke_styling_hooks`,
  `smoke_virtual_light_toggle`, `smoke_zoom_out` — слабая связь только по общему `_model`; diff их не
  трогает (подтверждено чтением diff), тема — рендер устройств/зум/тени, не путь tab-drag.
- `python -m pytest tests_backend` — diff не затрагивает `custom_components/**/*.py` (подтверждено
  `git diff --stat`).
- Performance-профиль — ТЗ §11 явно снимает требование (линейный проход по ≤50 пространствам), в AC
  не назван.
- Полный `npm run golden:verify` по всей матрице как предмет построчного разбора — только то, что обе
  НОВЫЕ сцены дошли до `missing-baseline`, а не `error`; остальные ~74 «different»/«missing-baseline»
  сцены не относятся к #243 (диффом не менялись), это известный долг непринятых baseline на `dev`,
  предрелизная обязанность (Правило 13), не этого код-ревью.
- `npm run golden:accept` — не выполнялся и не должен выполняться в этом цикле.
- Реальный `gh run view` канонического Docs screenshots прогона (`runs/32585516781`) — не открывался;
  достаточным доказательством честности `screenshots.json` служит локально пройденный
  `check-docs.mjs` (сверяет фингерпринт с текущим `src/**` независимо от источника коммита) и то, что
  ни один `imageSha256` не изменился — переснятых PNG нет, только пересчитан source-хэш.

## Проверка AC

Полный повторный разбор (не по дельте относительно r1), так как раунд открыт ребейзом, а не
находкой — см. «Почему это r2».

| AC | Итог | Как доказано |
|---|---|---|
| AC1 | Выполнен | `smoke_space_tab_reorder`: `realMouseMovedTabLeft`, `firstDropWroteOnce`, `sameTabMovedRight`, `secondDropWroteOnce` — все `true` (лично прогнано на `e6ac033`); жест — трастед `page.mouse`, capture сохраняется (`captureKeptButTargetResolved`) |
| AC2 | Выполнен | Smoke: `leftDropUsesBeforeSide`/`rightDropUsesAfterSide`, `beforeDividerHasPositiveInset`/`afterDividerHasNegativeInset`; golden-отчёт лично прочитан: `insetX` `+1.149`/`-1.149`, `placement` совпадает с ожидаемым |
| AC3 | Выполнен | Smoke: `subThresholdStayedClick`, `subThresholdDidNotWrite`, `clickStillSwitchesSpace` |
| AC4 | Выполнен | Smoke: `outsideClearsDropTarget`, `outsideReleaseEndedDrag`, `outsideReleaseDidNotWrite`, `nextClickWorksAfterOutsideRelease` |
| AC5 | Выполнен | Smoke: `pointerCancelEndedDrag`/`DidNotWrite`, `dragWasActiveBeforeDetach`/`detachEndedTheDrag`/`detachedCardDidNotWrite`/`orderSurvivedDetach`; полный `mutation-gate --check` зелёный, включая адаптированный `tab-drag-outlives-the-card` (проверено, что адаптация под новую строку `_tabSuppressClickTimer` не ослабила мутант) |
| AC6 | Выполнен | Smoke: `touchDidNotReorder`, `notReorderableInView`/`viewDidNotReorder`, `fixedFloorNotReorderable`; отдельно прогнан `smoke_fixed_floor` — PASS; `canStartTabDrag`-гейт в `_tabPointerDown`/`_canReorderTabs` diff'ом не тронут (сверено чтением) |
| AC7 | Выполнен, разобран по коду, не новым тестом | Тело `_commitTabOrder` (`src/houseplan-card.ts:1421-1450`) не изменено этим diff — прочитано целиком и сверено с diff-хунками: единственная правка со стороны вызова — `_tabPointerUp` передаёт `target.targetId` вместо `drag.overId`; active-space/toast/маркеры подтверждены smoke (`activeSpaceUnchanged`, `danglingMarkerPinnedToItsOldSpace`, `warnedAboutPositionalFloor`/`warningNotRepeated`) |
| AC8 | Выполнен | `artifacts/golden/golden-report.json` лично прочитан для обеих новых сцен: `tabDrag.ok: true` для каждой, semantic guard (`dragging`/`targetId`/`placement`/знак inset/размер rect) прошёл на реальном жесте до сравнения с (отсутствующим) baseline; `test/golden-matrix.test.mjs` тест на структуру матрицы — в `npm test` |
| AC9 | Выполнен | Typecheck/unit/build/3-бандла зелёные лично; `docs/CHANGELOG.md`/.ru.md, `docs/USER-GUIDE.md`/.ru.md изменены в том же коммите `e6ac033`, что и поведение, с `User-Visible: yes`; process-gate зелёный на весь диапазон |

## Закрытие раунда r1

r1 закрылся зелёным вердиктом с нулём находок — таблицы «находка → чем закрыта» в обычном виде не
требуется, потому что нечего закрывать содержательно. Единственное, что изменилось между r1 и r2, —
техническое: ребейз ветки на новый `dev` и коммит с принятием нового screenshot-фингерпринта.

| Что было в r1 | Что произошло между r1 и r2 | Где это видно |
|---|---|---|
| Implementation-коммит `f4de527`, зелёный вердикт, 0 находок | Слияние конфликтовало на `docs/images/screenshots.json`; владелец вернул issue в `S6-in-progress` **без указания на дефект кода**, только для ребейза | Комментарий issue `2026-08-22T16:40:03Z`: «Код-ревью зелёное — вердикт выше в силе, переделывать работу не нужно. Не удалось только слияние» |
| — | Ветка перебазирована на `origin/dev` `56a3977`; тот же продуктовый diff получил новый SHA `e6ac033`; конфликт в `screenshots.json` разрешён в пользу канонического набора нового `dev`, добавлен коммит `e4fe502` с новым source-фингерпринтом | `git show e6ac033 --stat` (файлы идентичны списку из CODE-REVIEW-243-r1.md), `git show e4fe502` (только `screenshots.json`, `imageSha256` не изменились) |
| Диагноз/AC1–AC9/находки r1 | Не изменялись правкой по замечанию — весь этот документ содержит самостоятельную повторную проверку каждого AC на `e6ac033`, а не перенос вывода r1 | Раздел «Проверка AC» выше, гейты лично прогнаны заново на текущем `HEAD` |

Других находок в r1 не было, поэтому таблица короче стандартного вида «находка | чем закрыта | где
видно» — здесь нечего закрывать, кроме самого факта ребейза.

## Унаследовано из r1

По правилу «ребейз — другой код» (PROCESS.md §2.10, §7.2) наследование выводов **о самом
implementation-диффе** в этом документе не применялось — весь код e6ac033 прочитан и все гейты
прогнаны заново лично, независимо от чисел и выводов `docs/reviews/CODE-REVIEW-243-r1.md`.

Унаследовано (не пересматривалось в этом раунде, так как относится к этапу, диффом не задетому):

- **ТЗ и его ревью.** `docs/specs/243-space-tab-drop-target.md` (`7ac1934`) и
  `docs/reviews/SPEC-REVIEW-243-r1.md` — продуктовая рамка, скоуп/не-скоуп, формулировка AC1–AC9 не
  пересматривались повторно как предмет SPEC-ревью: файл ТЗ не менялся ни на ребейзе, ни в этом
  диапазоне (подтверждено — в diff `origin/dev...HEAD` нет хунка по `docs/specs/243-*.md` после
  начального коммита `133fdc9`, который сам входит в этот диапазон и таким образом фактически
  перепрочитан в п.4 «Как проверялось», а не просто унаследован).
- **Математика #220** (`reorderSpaceIds`/`applySpaceOrder` в `src/space-order.ts`) — файл этим diff'ом
  не тронут; её корректность установлена ревью #220 и покрыта существующими unit-тестами, которые
  остаются зелёными (`npm test`, 1091/1091). Несмотря на это, семантика знака `before`/`after` из
  `_tabDropTargetAt` вручную сверена с ней заново в этом раунде (см. «Как проверялось», п.8) — это не
  чистое наследование, а самостоятельная перепроверка стыка нового и старого кода.
- **Канонический прогон Docs screenshots** (`runs/32585516781`) — сам факт существования и «Chromium
  151, 0 изменённых PNG» принят со слов коммита `e4fe502` и подтверждён локально только через
  `check-docs.mjs` (фингерпринт совпадает) и через `imageSha256`, не через открытие лога прогона в
  Actions.

## Находки

Находок нет — ни High, ни Medium, ни Low.

Отдельно проверенные риски ложной уверенности, снятые самостоятельным разбором этого раунда (не
переносом выводов r1):

- **Не ослабила ли адаптация мутанта `tab-drag-outlives-the-card` под новый код регресс-контроль
  #220?** Нет: `find`/`replace` теперь целится в блок `this._endTabDrag(); clearTimeout(this._tabSuppressClickTimer);`
  внутри `disconnectedCallback` — та же строка `_endTabDrag()` вырезается, только соседняя строка,
  под которую делается патч, сменилась из-за появления `_tabSuppressClickTimer`. Мутант лично прогнан
  в составе полного `mutation-gate --check` и помечен `ok`.
- **Не привёл ли ребейз к скрытому конфликту поведения** (например, если между `f4de527` и `e6ac033`
  в `dev` появился код, трогающий тот же путь `.tabs`/`_setMode`/`_pickSpace`)? Нет: `origin/dev`
  сейчас — `56a3977`, ровно тот SHA, на который ветка перебазирована согласно комментарию автора;
  других коммитов дальше нет (`git log 56a3977..origin/dev` — пусто), то есть весь diff, который я
  вижу, — это ровно послерейбейзный итог, без дополнительного скрытого дрифта.
- **Не подменяет ли `check-docs.mjs` (класс C, `screenshots.json`) продуктовую проверку** — не
  относится к продуктовому поведению #243 напрямую, но входит в обязательный гейт `docs` (§8); диффом
  подтверждено, что изменение чисто конфликт-резолюшн (0 изменённых PNG), не попытка обойти гейт.
- Риски, разобранные в r1 и переподтверждённые самостоятельно в этом раунде (двойная доставка
  `pointerup`, `pointercancel` — отдельный путь от `pointerup`, освобождение мыши golden-харнессом в
  `finally`, соответствие диагноза ТЗ фактическому фиксу через перенос `pointermove` на `.tabs`) — см.
  «Как проверялось», пп. 6–7, где вывод получен самим ревьюером этого раунда, а не цитированием r1.

## Что проверено и корректно

- Диагноз ТЗ (per-tab listener + retargeting после `setPointerCapture` фиксирует цель на источнике)
  устранён тем способом, который ТЗ §19 п.2 разрешал (обработчик на `.tabs`); подтверждено чтением и
  тем, что мутант, возвращающий старую адресацию, ловится смоком.
- Координатный hit-test (`_tabDropTargetAt`) реализует правила §7 ТЗ: попадание по
  `getBoundingClientRect()`, исключение исходной вкладки, `before`/`after` по индексу в модели (не по
  геометрии — вручную пересчитано в этом раунде), сброс цели при промахе, устойчивость к wrap (rect
  конкретного элемента).
- Визуальный контракт (`drop-before`/`drop-after`, `inset` box-shadow разного знака, один theme token)
  соответствует §9; подтверждено golden-отчётом (числовые значения `insetX` лично прочитаны).
- Двойная доставка `pointerup` не воспроизводится по построенной самостоятельно модели событий:
  локальный листенер на захватившей вкладке снимает оконный листенер до того, как событие всплывает
  туда же.
- `_endTabDrag()` в `_pickSpace`/`_setMode` — не расширение скоупа: прямо предписано контрактом
  завершения ТЗ §8 («смена режима/пространства... очищают drag»), покрыто smoke
  (`modeChangeEndsDrag`/`modeChangeDidNotWrite`) и дополнительно личным прогоном `smoke_modes.mjs`
  (OK) — путь `_setMode`, который получил новый вызов, не сломан.
- Три новых мутационных guard'а (§14 ТЗ) индивидуально проверены как способные покраснеть; полный
  реестр `mutation-gate --check` зелёный целиком, включая адаптированный унаследованный мутант #220.
- Оба changelog, `docs/USER-GUIDE.md`/.ru.md, `docs/TESTING.md` обновлены в одном user-visible
  коммите `e6ac033`; терминология («вкладка», «разделитель», «сторона вставки») согласована с ТЗ и
  USER-GUIDE, не изобретена.
- Класс файлов и трейлеры на всех пяти коммитах диапазона — `Issue: #243` везде, `User-Visible: yes`
  только на `e6ac033`; ветка `issue/243-space-tab-drop-target`; `process-gate.mjs` подтверждает 0
  предупреждений на весь диапазон.
- Коммит `e4fe502` (принятие screenshot-фингерпринта) — генерируемый класс C, ссылается на реальный
  канонический прогон, не переснимал ни одного PNG, `check-docs.mjs` зелёный после него.

## Чего не проверял

- Полный `npm run golden:verify` по всем сценам построчно как предмет разбора — только то, что две
  НОВЫЕ сцены дошли до `missing-baseline`, а не `error`, и что их `runtime.tabDrag.ok === true`.
  Остальные «different»/«missing-baseline» сцены — известный долг непринятых baseline на `dev`,
  предрелизная обязанность, не задача этого код-ревью.
- `smoke_audit_1490`, `smoke_glow_blending`, `smoke_render_perf`, `smoke_styling_hooks`,
  `smoke_virtual_light_toggle`, `smoke_zoom_out` — не прогонялись; связь со smoke-select только по
  общему `_model`, тема не пересекается с изменённым путём.
- `python -m pytest tests_backend` — не запускался, backend не тронут этим диапазоном.
- Performance-профиль — не запускался, не назван в AC, обоснование ТЗ §11 (≤50 пространств, линейный
  проход) проверено чтением, не измерением.
- Лог канонического прогона Docs screenshots (`runs/32585516781`) в GitHub Actions — не открывался;
  доверие основано на локальном `check-docs.mjs` и неизменности `imageSha256`, а не на просмотре лога.
- Ручное визуальное сравнение golden PNG для двух новых сцен — нет предмета: baseline ещё не принят и
  не должен приниматься в этом цикле.

## Вердикт

Раунд открыт ребейзом на ушедший вперёд `dev`, а не находкой предыдущего ревью — r1 был зелёным с
нулём находок. Согласно PROCESS.md §2.10/§7.2 («после ребейза это другой код») разбор проведён
полностью и самостоятельно на текущем `HEAD` (`e4fe502`, implementation-коммит `e6ac033`), без опоры
на числа документа r1: все девять AC заново доказаны — восемь автотестом (лично прогнанный browser
smoke на трастед `page.mouse`, полный mutation-gate, golden semantic guard с лично прочитанным
`runtime.tabDrag`, golden-matrix unit) и один (AC7) разобран чтением кода с явной пометкой «проверено
чтением, не исполнением» для тела `_commitTabOrder`, которое diff не менял. Обязательные и относящиеся
к diff'у дополнительные гейты прогнаны лично, включая один сверх списка r1 (`smoke_modes.mjs`, задет
новой точкой вызова `_endTabDrag()` в `_setMode`). Единственный не-код коммит раунда (`e4fe502`,
принятие screenshot-фингерпринта после разрешения конфликта) проверен: 0 переснятых PNG, ссылка на
канонический прогон, `check-docs.mjs` зелёный. Находок нет.

**Вердикт: зелёный · заход r2 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче**
