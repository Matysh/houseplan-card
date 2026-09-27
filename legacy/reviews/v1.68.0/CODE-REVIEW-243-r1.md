# CODE-REVIEW-243-r1

- Issue: [#243](https://github.com/Matysh/houseplan-card/issues/243) — «Перетаскивание вкладок пространств не работает: захват указателя съедает
  цель. Плюс нужен указатель места вставки»
- Этап: code (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- ТЗ: `docs/specs/243-space-tab-drop-target.md` (`7ac1934`), SPEC-REVIEW: `docs/reviews/SPEC-REVIEW-243-r1.md`, вердикт зелёный
- Диапазон: `origin/dev..HEAD`, 3 коммита:
  - `7ac1934` `docs(spec): define reliable space tab drop target` (класс C, `Issue: #243`, `User-Visible: no`)
  - `628e1a1` `docs: review document for #243` (класс C, SPEC-REVIEW документ)
  - `f4de527` `fix(tabs): restore captured mouse reordering` (класс A/B/C/D, `Issue: #243`, `User-Visible: yes`) — единственный коммит, меняющий продуктовое поведение
- Ревьюер этого раунда не имеет контекста реализации; материал — диапазон коммитов и diff, не рассказ автора.

## Скоуп ревью

Первый заход код-ревью, предыдущего вердикта по этому этапу нет — разбор ниже полный, разделы «Закрытие раунда r0» и «Унаследовано из r0» не применяются (PROCESS.md §2.10 относится только к r2+).

Изменённые файлы продуктового/тестового кода (`f4de527`):

```
src/houseplan-card.ts             78 +++--
src/styles.ts                      3 +-
demo/smoke_space_tab_reorder.mjs 497 (переписан на трастед page.mouse)
demo/golden/harness.mjs           68 ++ (семантический guard для tabDrag-сцен)
demo/golden/matrix.mjs             8 +- (2 новые сцены)
demo/golden/run.mjs                7 ++ (release мыши в finally)
scripts/mutation-gate.mjs         48 ++ (3 новых мутанта)
test/golden-matrix.test.mjs       23 ++
docs/CHANGELOG.md / .ru.md, docs/USER-GUIDE.md / .ru.md, docs/TESTING.md, docs/images/screenshots.json — в том же коммите
```

## Как проверялось

1. Прочитан `docs/SCOPE.md` — задача чинит регрессию выпущенной функции J6 («keep the plan true as the home evolves», сортировка вкладок), персона home admin, поверхность — desktop-редакторы. Новый видимый элемент (разделитель) не расширяет мандат — делает уже принятый контракт #220 честным, не новую фичу.
2. Прочитаны `AGENTS.md`, `PROCESS.md` целиком (классы файлов, §2.7, §4 лимит циклов, §7.2 шаблон вердикта, §8 гейты, §2.10 — не применяется к r1).
3. Прочитано тело issue #243 и все шесть комментариев (аналитика, занятие автором ТЗ, сдача ТЗ, вердикт SPEC-REVIEW, занятие разработчиком, хендофф реализации).
4. Прочитан ТЗ `docs/specs/243-space-tab-drop-target.md` целиком и сверен с diff по каждому разделу (контракт hit-testing §7, контракт завершения §8, визуальный контракт §9, AC1–AC9 §12).
5. Прочитан `docs/USER-GUIDE.ru.md`/`.md` — новая формулировка «тонкий разделитель показывает точную сторону вставки» согласована с текстом ТЗ, терминология не расходится.
6. Построчно прочитан diff `src/houseplan-card.ts`: `_tabPointerDown`, новый `_tabDropTargetAt`, переписанные `_tabPointerMove`/`_tabPointerUp`, новый `_suppressNextTabClick`, правки `_endTabDrag`-вызовов в `_pickSpace`/`_setMode`/`disconnectedCallback`, изменение шаблона рендера (`@pointermove` переехал с каждой `.tab` на контейнер `.tabs`, класс `droptarget` заменён на `drop-before`/`drop-after`).
7. Прочитан diff `src/styles.ts` — два класса `drop-before`/`drop-after` с `inset` box-shadow на разных сторонах, один theme token, без отдельной dark-палитры — соответствует §9 ТЗ.
8. Прочитан diff `demo/smoke_space_tab_reorder.mjs` целиком (497 строк) — подтверждено, что все позитивные сценарии (AC1–AC4) используют `page.mouse.move/down/up`, а не `dispatchEvent`; синтетический `dispatchEvent` остался только в touch- и pointercancel-негативных ветках (AC5/AC6), как и требует ТЗ §13.1.
9. Прочитан diff `demo/golden/harness.mjs`, `matrix.mjs`, `run.mjs`, `test/golden-matrix.test.mjs` — семантический guard, две новые сцены, релиз мыши в `finally`, unit-проверка структуры сцен.
10. Прочитан diff `scripts/mutation-gate.mjs` — три новых мутанта с id из ТЗ §14, плюс правка существующего мутанта `tab-drag-outlives-the-card` под новые поля state (`_tabSuppressClickTimer`).
11. Прочитаны трейлеры всех трёх коммитов и структура коммита `f4de527` — код и документация (CHANGELOG RU+EN, USER-GUIDE RU+EN, TESTING.md, docs screenshot fingerprint) в одном коммите, как требует `User-Visible: yes` (Правило 10, §2.6).
12. Прогнаны гейты (раздел ниже) лично, не со слов автора.

## Гейты — что прогнано и почему

Обязательные всегда (PROCESS.md §8):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Unit | `npm test` | PASS — 1078 tests, 1078 pass, 0 fail |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | PASS, обе копии идентичны dist |
| Docs fingerprint | `node scripts/check-docs.mjs` (обязателен — diff трогает `src/**`) | PASS — «Documentation checks passed (7 files, 10 external links)» |

По необходимости, определяемой diff/AC:

| Гейт | Команда | Результат | Почему прогнан |
|---|---|---|---|
| Smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Прямое совпадение: `smoke_space_tab_reorder`. Слабая связь по `_model` (10 смоков) | Обязателен для решения по выборке |
| Целевой browser smoke | `node demo/smoke_space_tab_reorder.mjs` | OK, все 37 полей `true` | Прямое совпадение из smoke-select, AC1–AC6 |
| Mutation-gate, новые id | `node scripts/mutation-gate.mjs --id=tab-drag-target-follows-captured-source` / `--id=tab-drop-indicator-always-before` / `--id=tab-drop-outside-commits-last-target` | Каждый: «поймано 1 из 1» | Именно эти три мутанта — доказательство «тест умеет падать» для AC1/AC2/AC4 |
| Mutation-gate, полный реестр | `node scripts/mutation-gate.mjs --check` | 118 из 118 «ok», включая старые `tab-drag-outlives-the-card`, `tab-drag-survives-release-outside`, `tab-reorder-eats-click`, `tab-reorder-ignores-pointer-type` | Дешёвый прогон (несколько секунд на мутант), проверяет, что правка не сломала мутанты #220, изменённые в этом diff (`tab-drag-outlives-the-card`) |
| Golden verify (целевые сцены) | `npm run golden:verify -- --only=space-tab-drop-before-light,space-tab-drop-after-dark` (флаг `--only` не ограничил вывод — прогнался весь набор) | Обе новые сцены: `missing-baseline` (не `error`) | AC2/AC8 требуют доказательства семантического guard; `missing-baseline` вместо `error` доказывает, что `prepareGoldenScenario` дошёл до сравнения с baseline, то есть блок `if (!state.ok) throw` в `harness.mjs` не сработал — семантический guard (dragging/target/side/inset/trusted-move) прошёл на реальном `page.mouse`-жесте |
| Слабые связи smoke-select (частично) | `node demo/smoke_fixed_floor.mjs`, `node demo/smoke_space_card.mjs`, `node demo/smoke_deeplink.mjs`, `node demo/smoke_kiosk_pan_lock.mjs` | Все PASS/OK | Выбраны как релевантные по теме diff (fixedFloor/навигация вкладок затронуты AC6, `_pickSpace`/`_setMode` получили новый вызов `_endTabDrag()`) |
| Process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD` | «гейт пройден, предупреждений 0» | Дешёвый офлайн-гейт, трейлеры/класс файлов/ветка |

**Не прогонялось и почему:**

- `smoke_audit_1490`, `smoke_glow_blending`, `smoke_render_perf`, `smoke_styling_hooks`, `smoke_virtual_light_toggle`, `smoke_zoom_out` — слабая связь по общему `_model` без семантической близости к tab-drag пути; diff их не трогает (подтверждено чтением diff: ни один из этих файлов не изменён, а их предмет — рендер устройств/зум/тени, не порядок вкладок).
- `python -m pytest tests_backend` — не прогонялся: diff не затрагивает `custom_components/**/*.py` (подтверждено `git diff --stat`).
- Performance-профиль — не прогонялся: ТЗ §11 явно снимает требование (линейный проход по ≤50 пространствам), в AC не назван.
- Полный `npm run golden:verify` по всей матрице как предмет анализа (а не только двух новых сцен) — не разбирался построчно: 74 «different»/остальные «missing-baseline» сцены не относятся к #243 (не изменены этим diff), это уже известный необслуженный долг непринятых baseline на `dev`, зафиксированный автором в хендоффе; для этого code-review имеет значение только то, что новые сцены дошли до `missing-baseline`, а не упали на семантике.
- `npm run golden:accept` — не выполнялся и не должен: baseline принимается только из reviewed Linux CI artifact перед бетой (Правило 13), не в этом цикле.

## Проверка AC

| AC | Итог | Как доказано |
|---|---|---|
| AC1 | Выполнен | `smoke_space_tab_reorder`: `realMouseMovedTabLeft`, `firstDropWroteOnce`, `sameTabMovedRight`, `secondDropWroteOnce` — все `true`; жест — `page.mouse`, capture сохраняется (`captureKeptButTargetResolved`) |
| AC2 | Выполнен | Smoke: `leftDropUsesBeforeSide`/`rightDropUsesAfterSide`, `beforeDividerHasPositiveInset`/`afterDividerHasNegativeInset`; golden: обе сцены прошли семантический guard (см. таблицу гейтов) |
| AC3 | Выполнен | Smoke: `subThresholdStayedClick`, `subThresholdDidNotWrite`, `clickStillSwitchesSpace` — движение < 4px осталось кликом без записи и без второго действия |
| AC4 | Выполнен | Smoke: `outsideClearsDropTarget`, `outsideReleaseEndedDrag`, `outsideReleaseDidNotWrite`, `nextClickWorksAfterOutsideRelease` |
| AC5 | Выполнен | Smoke: `pointerCancelEndedDrag`/`pointerCancelDidNotWrite`, `dragWasActiveBeforeDetach`/`detachEndedTheDrag`/`detachedCardDidNotWrite`/`orderSurvivedDetach`; мутант `tab-drag-outlives-the-card` (унаследован от #220, всё ещё красный при мутации — проверено полным mutation-gate) |
| AC6 | Выполнен | Smoke: `touchDidNotReorder`, `notReorderableInView`/`viewDidNotReorder`, `fixedFloorNotReorderable`; unit-контракт `canStartTabDrag` не тронут и остаётся зелёным в `npm test` |
| AC7 | Выполнен, разобран по коду (не новым тестом) | `_commitTabOrder` — тело функции не изменено этим diff (сверено чтением: единственные правки в файле — сигнатура вызова `_tabPointerUp` → `_commitTabOrder(drag.id, target.targetId)`, сам метод материализации/`_saveConfig`/toast остался прежним); active-space неизменность и однократный toast подтверждены smoke (`activeSpaceUnchanged`, `danglingMarkerPinnedToItsOldSpace`, `warnedAboutPositionalFloor`/`warningNotRepeated`) |
| AC8 | Выполнен | Golden: обе новые сцены дошли до `missing-baseline` (не `error`) — semantic guard в `harness.mjs` (`dragging`/`targetId`/`placement`/inset знак/непустой rect) прошёл на реальном `page.mouse`-жесте; `test/golden-matrix.test.mjs` (новый тест «space-tab drop goldens hold both insertion sides…») проверяет структуру матрицы (`npm test` PASS) |
| AC9 | Выполнен | Typecheck/unit/build/3-bundle зелёные (см. таблицу гейтов); `docs/CHANGELOG.md`, `.ru.md`, `docs/USER-GUIDE.md`, `.ru.md` изменены в том же коммите `f4de527`, что и поведение, с `User-Visible: yes` |

## Находки

Находок нет — ни High, ни Medium, ни Low.

Отдельно проверенные риски ложной уверенности, снятые разбором:

- **Не является ли smoke обходом бага той же природы, что диагностировал ТЗ?** Нет: весь diff smoke-теста построчно прочитан (см. «Как проверялось», п.8) — позитивные AC1–AC4 используют `page.mouse.move/down/up`, а не `target.dispatchEvent(new PointerEvent(...))`; синтетический `dispatchEvent` остаётся только в touch-негативной ветке (AC6) и в ручном `pointercancel` (AC5, где явная цель — проверить конкретную ветку `event.type`, что сама ТЗ §13.1 разрешает).
- **Действительно ли перенос `pointermove`-listener с каждой `.tab` на контейнер `.tabs` — не косметика, а исправление первопричины?** Да: после `setPointerCapture` событие ретаргетируется на захвативший элемент, но продолжает всплывать по DOM от него; старый код вешал обработчик на каждую `.tab` в отдельности, поэтому только обработчик исходной вкладки получал событие (с захардкоженным `overId` того элемента, на который он был навешен) — вкладки-соседи вообще не видели этот `pointermove`. Слушатель на общем контейнере получает всплывшее событие независимо от того, какая вкладка была исходной, и определяет цель уже по `clientX/clientY`, а не по тому, чей обработчик сработал. Логика подтверждается тем, что новый мутант `tab-drag-target-follows-captured-source` (возвращающий старую адресацию через координаты источника вместо курсора) ловится смоком.
- **Не сломался ли контракт «клик после drag не переключает пространство» при переносе состояния в отдельный `_tabSuppressClick`-флаг вместо проверки `this._tabDrag?.moved` в `_tabClick`?** Проверено: `_tabDrag` обнуляется синхронно внутри `_tabPointerUp` до того, как браузер успевает дать `click`, поэтому проверка `this._tabDrag?.moved` в `_tabClick` была бы уже нерабочей к моменту клика; новый явный флаг `_tabSuppressClick`, выставляемый до `_endTabDrag()` и потребляемый ровно одним следующим `_tabClick`, — корректная замена. Smoke `activeSpaceUnchanged` после обоих реальных drop показывает, что паразитный клик не переключает пространство.
- **Не расширяет ли `_endTabDrag()`, добавленный в `_pickSpace` и `_setMode`, скоуп задачи?** Нет: это защитное завершение затянувшегося drag при программной навигации/смене режима, прямо предписанное контрактом завершения ТЗ §8 («смена режима/пространства... очищают drag»); покрыто smoke (`modeChangeEndsDrag`/`modeChangeDidNotWrite`).
- **Не потерялась ли материализация fallback-маркеров/expected_rev (AC7) при рефакторинге?** Нет — тело `_commitTabOrder` не изменено этим diff, сверено построчно; только сигнатура вызова со стороны `_tabPointerUp` меняет второй аргумент с `drag.overId` на `target.targetId`.

## Что проверено и корректно

- Диагноз ТЗ (per-tab listener + retargeting после `setPointerCapture` фиксирует `overId` на источнике) воспроизведён и устранён именно тем способом, который ТЗ §19 п.2 разрешал как одну из опций (обработчик на `.tabs`).
- Координатный hit-test (`_tabDropTargetAt`) реализует все пять правил §7 ТЗ: попадание строго по `getBoundingClientRect()`, исключение исходной вкладки и `.tabadd` (у неё нет `data-hp="space-tab"` — проверено grep), `before`/`after` по индексу в модели, а не по геометрии, сброс цели при промахе, устойчивость к wrap (rect конкретного элемента, не строки).
- Визуальный контракт (`drop-before`/`drop-after`, `inset` box-shadow с положительным/отрицательным знаком, один theme token) соответствует §9; подтверждено и smoke (`insetX`), и golden semantic guard.
- Двойная доставка `pointerup` (риск ТЗ §18 п.4) не воспроизводится: `_endTabDrag()` снимает оконные listeners внутри того же вызова, что и обрабатывает первую доставку, поэтому вторая (оконная) доставка того же физического события до второго вызова не доходит — не тестируется отдельным сценарием, но логически следует из существующего `tab-drag-survives-release-outside`/`tab-drag-outlives-the-card` мутационного покрытия, которое осталось зелёным.
- `pointercancel` идёт отдельным путём от `pointerup` внутри одной функции `_tabPointerUp` через проверку `event.type === 'pointerup'`, что корректно, так как один и тот же `_tabDragRelease` обработчик регистрируется на оба типа событий на `window`.
- Golden-харнесс освобождает мышь в `finally` (`demo/golden/run.mjs`) даже при падении семантической проверки — снимает риск ТЗ §18 п.5 («golden удерживает мышь между сценами»).
- Три новых мутационных guard'а (§14 ТЗ) заведены, каждый по отдельности «поймано 1 из 1»; существующий мутант `tab-drag-outlives-the-card` адаптирован под новое поле `_tabSuppressClickTimer` и остаётся в реестре.
- Оба changelog, `docs/USER-GUIDE.md`/`.ru.md`, `docs/TESTING.md`, docs screenshot fingerprint — обновлены в одном user-visible коммите; терминология руководства («вкладка», «разделитель», «сторона вставки») не изобретена заново, согласована с текстом ТЗ.
- Класс файлов: `f4de527` трогает A (`src/**`), B (`demo/**`, `scripts/**`, `test/**`), C (`docs/**`) и D (`dist/**`, `custom_components/houseplan/frontend/**`, `demo/srv/assets/**`) в одном коммите — по таблице PROCESS.md §1 это допустимо (правило про «только D» не применяется, здесь D сопровождает A/B/C в одном релизном шаге реализации, не самостоятельный промоушен).
- Ветка `issue/243-space-tab-drop-target`, трейлеры `Issue: #243` на всех продуктовых/тестовых/доковских коммитах, `User-Visible: yes` только на коммите с видимым поведением — соответствует Правилам 3, 10.

## Чего не проверял

- Полный `npm run golden:verify` по всем 88 сценам построчно как предмет разбора — только то, что две НОВЫЕ сцены (#243) дошли до `missing-baseline`, а не `error`. Остальные ~74 «different»/«missing-baseline» сцены не относятся к этому diff (не менялись им) и являются известным долгом непринятых baseline на `dev`, зафиксированным автором; их принятие — предрелизная обязанность (Правило 13), не этого код-ревью.
- `smoke_audit_1490`, `smoke_glow_blending`, `smoke_render_perf`, `smoke_styling_hooks`, `smoke_virtual_light_toggle`, `smoke_zoom_out` — не прогонялись; связь со smoke-select только по общему полю `_model`, тема (рендер устройств/зум/тени) не пересекается с изменённым путём (drag вкладок пространств).
- `python -m pytest tests_backend` — не запускался, backend не тронут.
- Performance-профиль — не запускался, не назван в AC, обоснование в ТЗ §11 (≤50 пространств, линейный проход) проверено чтением, не измерением.
- Кросс-браузерная эквивалентность `ShadowRoot.elementFromPoint()` — не актуально: реализация выбрала прямой перебор `getBoundingClientRect()`, а не `elementFromPoint`, поэтому этот пункт ТЗ §7 (альтернативный допустимый способ) не применяется к фактическому коду.
- Ручное визуальное сравнение golden PNG (нет предмета — baseline для двух новых сцен ещё не принят и не должен приниматься в этом цикле).

## Вердикт

Все девять AC доказаны — восемь автотестом (browser smoke с трастед `page.mouse`, mutation-gate, golden semantic guard, golden-matrix unit) и один (AC7) разобран чтением кода с явной пометкой «проверено чтением, не исполнением» для тела `_commitTabOrder», которое diff не менял. Диагноз ТЗ устранён по объявленному в ТЗ механизму (перенос `pointermove` на контейнер `.tabs`, координатный hit-test независимо от `event.target`). Три новых мутанта индивидуально проверены как «умеющие покраснеть»; полный реестр из 118 мутантов, включая унаследованные от #220, зелёный. Обязательные и относящиеся к diff дополнительные гейты прогнаны лично, результаты приведены с точными командами. Оба changelog, USER-GUIDE EN/RU и docs-фингерпринт обновлены в том же user-visible коммите. Находок нет.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче**
