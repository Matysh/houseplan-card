# CODE-REVIEW-648-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/648 —
  «Sections: вертикальный resize карточки и container-owned высота плана»
- **Этап:** `S7-code-review` (код-ревью, PROCESS.md §2.7)
- **Трек:** полный (`P2`, см. SPEC-REVIEW-648-r1.md)
- **Материал:** `git log --oneline origin/dev..HEAD` и
  `git diff origin/dev...HEAD`; вершина ветки —
  `b7fb7cf7e7bce13a44ef0e1af3b97541ddb0dffa`, база — `origin/dev` =
  `f68878cc44b818b6cfbdb3866302e6febaab2445`. Три коммита:
  `7f48e690` (feat, User-Visible: yes), `102b2ed7` (test, User-Visible: no),
  `b7fb7cf7` (test, User-Visible: no).
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4 (первый раунд
  код-ревью; предыдущий раунд — ревью ТЗ, `docs/reviews/SPEC-REVIEW-648-r1.md`,
  зелёный)
- **Роль:** ревьюер кода (не автор)

## Скоуп ревью

Диапазон меняет:

- `src/houseplan-card.ts` — новое публичное реактивное свойство `layout`
  (HA-сигнал), геттер `_containerOwnedHeight` (`panelHost || layout ===
  'grid'`), `getGridOptions()` → `{ columns: 'full', rows: 10, min_rows: 6 }`,
  замена `panelHost` на `_containerOwnedHeight` в четырёх местах расчёта
  высоты сцены (mode-transition target, `measuredCardHeaderHeight`,
  `settleSoftStageLayout`, inline `style="height:..."`);
- `src/boot-soft-layout.ts` — переименование параметра `panelHost` →
  `containerOwnedHeight` в `measuredCardHeaderHeight`/`settleSoftStageLayout`
  (поведение не меняется, кроме нового источника `true`);
- `src/styles/base.styles.ts` — CSS-селекторы `:host([layout="grid"])`
  добавлены рядом с существующими `:host([panel-host])`;
- `demo/smoke_sections_resize.mjs` (новый, 221 строка) — browser smoke;
  `demo/smoke_houseplan_panel.mjs` — соседний regression-oracle (AC7);
  `test/houseplan-panel.test.mjs` — обновлён текстовый oracle контракта #486;
- `scripts/mutation-registry.mjs` (4 новых мутанта), `scripts/smoke-links.mjs`
  (регистрация smoke по символам);
- документация: `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`, `docs/STATUS-FEATURES.md`, `docs/TESTING.md`,
  `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `dist/**`, `custom_components/houseplan/frontend/**` (класс D, пересобранный
  бандл — сверено побайтно, см. «Как проверялось» п.2).

Первый вопрос — какую строку `docs/SCOPE.md` задача обслуживает: прямого
Core-job нет, это инфраструктурная UX-правка поверхности, на которой живут
J1–J7 для персоны Home admin (Sections — основной тип dashboard в HA,
задача не расширяет функциональность плана и не входит в «Out of scope»).
Ровно так же было принято ревьюером ТЗ в SPEC-REVIEW-648-r1.md — конфликта
со SCOPE.md нет.

## Как проверялось

1. Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
   тело issue #648 (раздел `## ТЗ`, K1–K12, AC1–AC10), и
   `docs/reviews/SPEC-REVIEW-648-r1.md` (единственный предыдущий раунд —
   ревью ТЗ, зелёный, без Medium/High).
2. Прочитан полный `git diff origin/dev...HEAD` по каждому изменённому
   файлу `src/**`, `demo/smoke_sections_resize.mjs`,
   `demo/smoke_houseplan_panel.mjs`, `test/houseplan-panel.test.mjs`,
   `scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`, всех
   изменённых `docs/*.md`.
3. Пересобрал бандл (`npm run build` → `npm run bundle:sync`) на материале —
   `git status` после сборки чист: committed `dist/**` и
   `custom_components/houseplan/frontend/**` побайтно совпадают с
   пересобранными, обновлять было нечего.
4. Прогнаны гейты (список — «Что прогнал» ниже); дешёвые (`typecheck`
   внутри `build`, `npm test`, `npm run build`) уже подтверждены зелёным
   Validate на этом точном SHA (см. ссылку в задании), их не переганивал;
   `check-docs.mjs`, `no-new-any.mjs`, `no-new-private-writes.mjs`,
   `bundle:budget` прогнал сам, так как диф трогает `src/**`, а инструкция
   не считает их покрытыми чужим прогоном за меня.
5. Прогнал сам `smoke_sections_resize.mjs` и `smoke_houseplan_panel.mjs`
   (браузерные смоки Validate не гоняет вне `heavy`-условий — они не в
   материале, который мне назвали зелёным). Оба зелёные.
6. Через `node scripts/mutation-registry.mjs --id=<id>` прогнал все четыре
   новых мутанта задачи (`sections-grid-falls-back-to-viewport-height`,
   `sections-editor-transition-uses-window-height`,
   `sections-grid-drops-stage-flex-chain`,
   `sections-resize-drops-stage-refit-observer`) — каждый краснит именно
   `smoke_sections_resize.mjs`, репозиторий чист после каждого прогона
   (скрипт сам возвращает мутант и пересобирает). Это заполняет колонку
   «чем краснеет» для защитных AC2/AC4/AC5/AC7/AC8 предметно, а не по
   заявлению автора.
7. Прогнал `node scripts/smoke-select.mjs --base f68878cc4... --head
   b7fb7cf7e...` — «прямое совпадение» вернуло 19 смоков, включая оба
   названных в AC (`smoke_sections_resize.mjs`, `smoke_houseplan_panel.mjs`)
   и ряд смоков, делящих символы `_hdrH`/`_bootSoft`/`_stageEl`/`_warmSlot`
   с изменённым `boot-soft-layout.ts`. Из них выбрал и прогнал
   `smoke_render_invalidation.mjs` (единственный, читающий `_bootSoft`
   напрямую — сигнатура `settleSoftStageLayout` изменилась) и
   `smoke_warm_dialogs.mjs` (`_hdrH`+`_warmSlot`, соседняя soft-layout
   цепочка) как точечную regression-проверку рефактора параметра
   `panelHost → containerOwnedHeight`; оба зелёные. Остальные 15 прямых
   совпадений и 28 слабых связей не гонял — сочтено непропорциональным для
   рефактора, который для существующих layout (`layout` не установлен)
   математически не меняет значение `containerOwnedHeight` (было
   `panelHost`, осталось `panelHost || false`), см. «Чего не проверял».
8. Экспериментально проверил (не для отчёта CI, а для собственной
   уверенности): вручную заменил `language: 'ru'` на `'de'` в фикстуре
   `smoke_sections_resize.mjs`, прогнал — все проверки, включая
   `minimumSixRowsStayContained`, прошли и на немецкой локали; откатил
   правку (`git status` после отката чист). Это ограничивает находку
   Medium-1 ниже: код сейчас не ломается на German, но CI никогда не
   узнает, если сломается.
9. Проверил трейлеры всех трёх коммитов (`git log`) — `Issue: #648` на
   каждом, `User-Visible: yes` только на `7f48e690`, и оба changelog входят
   в этот же коммит (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — видно в
   `git show --stat 7f48e690`).
10. Сверил термины режимов (Plan/Devices/Backdrop → «План»/«Устройства»/
    «Подложка») со смоком, использующим внутренние имена `plan`/`devices`/
    `decor` — совпадает с существующим соответствием в `docs/USER-GUIDE.ru.md`
    (уже проверено ревьюером ТЗ).
11. Проверил, что `houseplan-space-card` (`src/space-card.ts`) не получил
    ни `getGridOptions`, ни ссылок на новое свойство `layout` (grep) —
    юнит-тест это же утверждает через `assert.doesNotMatch`.
12. Проверил «одно число — один источник» (§8): 10/6 фигурируют только как
    возврат `getGridOptions()` (единственный источник) и как проза в
    changelog/USER-GUIDE/ARCHITECTURE/STATUS-FEATURES/TESTING, дословно
    совпадающая с этим возвратом; отдельного хардкода этих чисел или
    пиксельных производных (≈632/≈376 из K2) в `src/**` или изменённых
    `docs/*.md` не нашёл (grep).

## Находки

### Medium-1 (в скоупе задачи). AC3 документально обещает browser smoke
«RU/DE», а поставленный smoke проверяет минимальную высоту только на
русской локали

**Файл:** `demo/smoke_sections_resize.mjs:64-101` (секция `minimumGeometry`),
конфиг `card.setConfig(config)` строка 72.

**Что не так.** Таблица AC issue #648 для AC3 называет доказательство
буквально: «Browser smoke RU/DE, geometry + scroll oracle» — для
наблюдаемого результата «На минимальных 6 строках View при узкой ширине и
**длинной локали** не выходит за slot; header доступен...». Раздел i18n
того же ТЗ поясняет зачем: «Существующие RU/DE длинные подписи входят в
визуальную проверку минимальной высоты» — RU и DE выбраны вместе не
случайно: `docs/TESTING.md:484-485` фиксирует немецкую локаль как
установленный в проекте эталон «длинных подписей», ломающих узкую/минимальную
раскладку («German View... fit at desktop and 390 px without horizontal
overflow or clipped actions»).

Фактически `card.setConfig(config)` в `demo/smoke_sections_resize.mjs:72`
задаёт `language: 'ru'` один раз на весь смок — включая блок
`minimumGeometry` (строки 91–101), который единственный проверяет минимум
6 строк на узкой ширине 390 px. Немецкая локаль нигде в файле не
упоминается (`grep -n "language\|'de'" demo/smoke_sections_resize.mjs` не
находит `de`). Половина заявленного в AC3 покрытия не существует как
исполняемый тест.

**Почему это находка, а не блокер существующей защиты.** Я не нашёл живого
дефекта: ручной эксперимент (заменил `'ru'` на `'de'` в этом же файле,
прогнал, откатил) показал, что на текущем коде `minimumSixRowsStayContained`
и `headerContained`/`menuReachable` проходят и на немецкой локали. Это не
регрессия сегодняшнего дня.

**Сценарий отказа.** Ближайшее изменение хедера/меню (например, более
длинная подпись пункта меню, добавленная в рамках другой задачи) может
сузить запас по немецкой локали на 390 px/6 строках, ничего не сломав по
русской. Ни один автотест в этом дифе и ни один существующий golden/сценарий
(проверено — `docs/golden`, `demo/docs` не содержат Sections/grid-сценария)
это не заметит: `smoke_sections_resize.mjs` — единственный исполняемый
свидетель AC3, и он проверяет только RU. Заявленная в согласованном ТЗ
защита «длинная локаль не переполняет минимальный slot» наполовину не
существует как код.

**Почему в скоупе и не блокирует зелёный.** Правка дешёвая — обернуть
существующий блок `minimumGeometry` (или отдельно вызвать `setConfig` с
`language: 'de'`) в цикл по `['ru', 'de']` и агрегировать оба результата в
`minimumSixRowsStayContained`; список поверхностей и файлов не меняется, не
требует новой инфраструктуры. Без High-находок это делает вердикт жёлтым, а
не переоткрывает задачу отдельным issue (#202).

## Что проверено и корректно

- **AC1** (grid defaults + `getCardSize`): `getGridOptions()` возвращает
  ровно `{ columns: 'full', rows: 10, min_rows: 6 }` без `max_rows`
  (`src/houseplan-card.ts:3762`); подтверждено исполнением обоих браузерных
  смоков (`executableGridDefaults`, `sectionsDefaultsRemainAvailableInPanel`)
  и юнитом, не читающим монолит как единственное доказательство (юнит —
  дополнение к исполняемому свидетелю, не замена). `space-card.ts` не имеет
  `getGridOptions` — подтверждено grep и юнитом.
- **AC2/AC3** (контейнерная высота, минимум 6 строк на 390 px): смок
  `smoke_sections_resize.mjs` реально измеряет `getBoundingClientRect()`
  `host`/`card`/`ha-card`/`header`/`stage` на живом собранном бандле —
  прогнан мной, зелёный (см. «Как проверялось» п.5). Кроме RU-ограничения
  из Medium-1, оракул содержательный: допуск 1 px, `stage.height > 0`,
  `cardScroll`/`haCardScroll` ≤ 1 (нет overflow/пустого хвоста).
- **AC4** (серия 6→10→14→6, камера/аспект не сбрасываются, нет ошибок
  ResizeObserver): проверено исполнением; мутант
  `sections-resize-drops-stage-refit-observer` (отключение
  `_roViewport.observe(stage)`) краснит именно этот smoke — «чем краснеет»
  предметно подтверждено мной, не только заявлено автором.
- **AC5** (переходы Plan/Devices/Backdrop не меняют внешний rect, нет
  busy-хвоста): смок ждёт реальный `_modeTransition.state` (не форсирует
  приватное состояние), проверяет `entering.to.stageHeight <=
  card.clientHeight + 1` на входе и выходе для всех трёх режимов при 10 и 6
  строках. Мутант `sections-editor-transition-uses-window-height`
  (возврат `innerHeight` вместо `containerOwnedHeight ? this.clientHeight`)
  краснит smoke — подтверждено прогоном.
- **AC6** (explicit `grid_options` остаётся главным, config не мутируется):
  `Object.freeze(config)` в фикстуре + сверка `JSON.stringify(config) ===
  configBefore` и `card._config.grid_options === config.grid_options` по
  идентичности объекта — сильнее обычного deep-equal, ловит скрытое
  клонирование. Не отдельный юнит-файл, а часть browser smoke (ТЗ называет
  «Unit + browser smoke» как два способа доказательства; по факту это один
  исполняемый смок) — расхождение в названии способа доказательства не
  снижает фактическое покрытие и не поднимается до отдельной находки (по
  аналогии со снятыми Low ревью ТЗ).
- **AC7** (без `layout=grid` — старое поведение; `space-card` без grid
  defaults): `card.layout = null` в смоке восстанавливает `100dvh` в
  реальном инлайн-стиле (`ordinaryCardKeepsViewportHeight`), проверено
  исполнением; `smoke_houseplan_panel.mjs` (panel-host, не grid)
  обновлён и прогнан мной отдельно — зелёный, панельная контейнерная
  высота не задета рефактором `panelHost → containerOwnedHeight`
  (математически `containerOwnedHeight === panelHost` когда `layout` не
  установлен).
- **AC8** (resize не создаёт кликов/тапов, hit-coordinates верны после
  resize): `moreInfo` счётчик остаётся 0, `stableMode === 'view'`,
  `postResizeHitCoordinatesMatchCamera` сверяет реальную матрицу
  `getScreenCTM()` SVG после шторма resize с `card._view` — не заявление, а
  геометрическая проверка через реальный DOM.
- **AC9** (30 изменений высоты без ResizeObserver loop/error): цикл из 30
  `frame()`-тиков с чередованием 6/14 строк, финальная геометрия и время
  (`stormElapsed < 3000`) проверены исполнением; `finish()` в
  `demo/serve.mjs` считает необработанные исключения карточки
  (`_pageErrors`) и красит прогон при их появлении — не только заявленные
  булевы поля.
- **AC10** (документация + credit): `docs/CHANGELOG.md`/`.ru.md`,
  `docs/USER-GUIDE.md`/`.ru.md`, `docs/ARCHITECTURE.md`,
  `docs/STATUS-FEATURES.md`, `docs/TESTING.md` все обновлены и
  проверены чтением; `@pando80` упомянут в обоих changelog с ссылкой на
  #648. `check-docs.mjs --screenshots=warn` (режим обычного пуша) прогнан
  мной — зелёный (единственная находка — WARN о неизменном скриншот-
  отпечатке, ожидаемо: диф не меняет визуальные пиксели плана/chrome,
  ТЗ прямо разрешает это в «Плане автотестов» п.7).
- **Трейлеры и changelog**: `Issue: #648` на всех трёх коммитах,
  `User-Visible: yes` только на `feat`-коммите и оба changelog редактируются
  именно в нём — соответствует AGENTS.md.
- **Одно число — один источник** (§8): 10 и 6 строк существуют один раз —
  как возврат `getGridOptions()`; вся документация и тесты лишь
  переиздают это значение прозой/сравнением, вторичного независимого
  источника не заведено.
- **Бандл воспроизводим**: пересборка (`npm run build && npm run
  bundle:sync`) на материале не породила диффа — закоммиченный `dist/**` и
  зеркала в `custom_components/houseplan/frontend/**`,
  `demo/srv/assets/**` побайтно совпадают с исходниками этого SHA.
- **Гейты, специфичные для `src/**`-дифа**: `no-new-any.mjs` (0 новых
  `any` в 31 добавленной строке `src/**`), `no-new-private-writes.mjs`
  (0 новых записей в приватное состояние карточки из 223 добавленных строк
  смоков — только чтения, что разрешено), `bundle:budget` (initial View
  291761 B, в пределах потолка) — все прогнаны мной и зелёные.
- **Юнит-тесты**: `npm test` — 3086 тестов, 3085 pass, 1 skip (не связан с
  этой задачей), 0 fail.
- **Область изменений**: `space-card.ts`, `panel-host`, Masonry, kiosk не
  тронуты кодом (только упомянуты в документации как «не меняются») —
  подтверждено grep по всем изменённым файлам и фактическим отсутствием
  правок вне `houseplan-card.ts`/`boot-soft-layout.ts`/`base.styles.ts`.

## Чего не проверял

- **Реальное поведение Home Assistant Sections вне этого репозитория.**
  Весь механизм задачи опирается на внешний контракт: что настоящий HA при
  размещении карточки в Sections/grid-дашборде действительно устанавливает
  на элементе свойство `layout = 'grid'` (K3/K11, оставлено ревью ТЗ как
  «принято предположительно, поменять свободно» — технический, не
  продуктовый вопрос). В этой песочнице нет ни реального HA, ни доступа к
  инструментам веб-поиска/GitHub-поиска (запрошенные `WebSearch` и
  `mcp__github__search_code` не были разрешены), поэтому свериться с
  исходником `home-assistant/frontend` я не смог. Все AC2–AC10 в этом
  дифе проверены только против синтетической фикстуры, которая
  устанавливает `card.layout = 'grid'` вручную (`demo/smoke_sections_resize.
  mjs:77`) — они доказывают, что *если* HA присылает этот сигнал, карточка
  ведёт себя правильно, но не доказывают, что HA действительно его
  присылает именно так (то же имя свойства, тот же момент жизненного цикла).
  Это прямой риск: если предположение неверно, весь фиче-код останется
  мёртвым в проде при полностью зелёных гейтах. Технически это ровно то
  место, которое ревью ТЗ явно делегировало код-ревью — фиксирую как
  открытый остаточный риск, а не как находку, потому что задача не может
  быть проверена исполнением без реального HA, а сам код внутри доступного
  материала последователен и не содержит внутренних противоречий.
- **15 из 19 «прямых совпадений» и все 28 «слабых связей» `smoke-
  select.mjs`.** Прогнал только `smoke_sections_resize.mjs`,
  `smoke_houseplan_panel.mjs` (названы в AC), `smoke_render_invalidation.mjs`
  и `smoke_warm_dialogs.mjs` (точечно — единственные, трогающие изменённую
  сигнатуру `settleSoftStageLayout`/`_bootSoft` напрямую). Остальные не
  гонял: рефактор `panelHost → containerOwnedHeight` в
  `boot-soft-layout.ts` математически не меняет значение для существующих
  (не-`grid`) карточек, поэтому регрессия там маловероятна; полный прогон
  матрицы — предрелизная обязанность, а не гейт код-ревью (§8).
- **`golden:verify`** — не прогонял. ТЗ прямо говорит: «Golden не
  требуется, если визуальные пиксели плана/chrome не меняются» — диф не
  трогает цвета/геометрию плана, только контейнерную высоту и CSS-flex;
  `check-docs.mjs` подтверждает отсутствие изменений в
  зафиксированных скриншот-сценариях документации (только WARN о
  фингерпринте, не ERROR).
- **`npm run invariants`** — не прогонял: диф не меняет геометрическую
  модель плана (стены/комнаты/устройства) и не трогает ссылки на неё,
  только презентационный слой карточки.
- **`python -m pytest tests_backend`** — не прогонял: диф не касается
  `custom_components/houseplan/**/*.py`.
- **Performance-профили** — не названы в AC этой задачи; ТЗ прямо
  запрещает новый observer/polling, а не вводит его (новый постоянный
  наблюдатель не добавлен — использован существующий `_roViewport`).
- **`typecheck`/`npm test`/`npm run build`/`golden`/`performance_smoke`/
  browser `smoke`-матрица целиком в CI** — доверился зелёному Validate на
  точном SHA `b7fb7cf7` (ссылка в задании) для `typecheck`/`test`/`build`;
  `npm test` и `npm run build` тем не менее перегнал сам (см. выше) для
  собственной уверенности перед прогоном смоков на пересобранном бандле —
  оба зелёные, совпадают с Validate.

## Вердикт

0 High, 1 Medium (в скоупе задачи, Medium-1 — неполное покрытие AC3
браузерным смоком: заявлены RU/DE, реализована только RU). Без High-находок
это жёлтый вердикт: автор дополняет `demo/smoke_sections_resize.mjs`
немецкой локалью в проверке минимальной высоты и проходит повторный раунд
код-ревью — отдельный issue не заводится (#202).

Всё остальное — AC1–AC2, AC4–AC10, трейлеры, changelog, гейты `typecheck`/
`npm test`/`npm run build`/`no-new-any`/`no-new-private-writes`/
`bundle:budget`/`check-docs`, четыре новых защитных мутанта и оба
относящихся к задаче browser smoke — проверено исполнением и корректно.

**Жёлтый.**

---

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче

---

<!-- material-anchors: подготовлено ревьюером -->

## Материал раунда

- Ветка: на момент ревью без явного имени в рабочей копии; вершина —
  `b7fb7cf7e7bce13a44ef0e1af3b97541ddb0dffa`.
- База сравнения: `origin/dev` = `f68878cc44b818b6cfbdb3866302e6febaab2445`.
- Дерево материала (`git rev-parse HEAD^{tree}` на момент ревью): снято на
  вершине `b7fb7cf7e7bce13a44ef0e1af3b97541ddb0dffa`, рабочая копия чиста
  до и после всех локальных гейтов/мутаций (`git status --porcelain`
  пуст).
- Предыдущий раунд (другой этап): `docs/reviews/SPEC-REVIEW-648-r1.md`,
  вердикт `green`, High 0, Medium 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/648-sections-card-resize`, коммит `b7fb7cf7e7bc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a7fe21e21d802c04986cbfab31f3065266c8e9ff`
  ```
  git log --all --format='%H %T' | grep a7fe21e21d80
  ```
- Тело issue: `8400466150bde494c01aef14b7d5961be36d721b08a28c69e800bd88ac645154`
- Вердикт конвейера: `yellow` · High 0
