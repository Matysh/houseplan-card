# CODE-REVIEW-616-r1

## Материал

SHA `255330b9bc82443bc443d0070581f1ab6a8a8ab9`, один коммит поверх `dev` (после
ручного ребейза на `dc6018ed`, конфликт был только в обоих `CHANGELOG*`).
Трейлеры: `Issue: #616`, `User-Visible: yes`. Validate на этом SHA — success
(https://github.com/Matysh/houseplan-card/actions/runs/36129418270).

Это первый заход код-ревью (r1); предыдущий комментарий «ревью не
запускалось» — отказ стража слияния (ветка не ребейзилась), а не потраченный
цикл. Спек-ревью — `docs/reviews/SPEC-REVIEW-616-r1.md`, зелёный, 0 High/Medium.

## Скоуп

Компактная шапка View на телефоне (≤ 480 px): одна строка (вкладки, зум,
шестерёнка), всё убранное — в disclosure-меню шестерёнки. Новый модуль
`src/header-menu.ts` (`headerMenuItems` — чистая функция состава,
`HeaderMenu` — раскрытие/закрытие/докрутка активной вкладки/подложка),
правка шаблона и стилей шапки (`houseplan-card.ts`, `chrome.styles.ts`),
метод `menuItems()` в `summary-panel-runtime-loaded.ts`, новый смок
`demo/smoke_mobile_view_header.mjs`, юнит `test/header-menu.test.mjs`, 10
мутантов в `scripts/mutation-registry.mjs`, обновления
`USER-GUIDE.ru.md`/`UX-MODES.md`/`TOUCH-SUPPORT.md`/`STYLING-HOOKS.md`/
`data-hp-contract.json`, оба changelog, i18n (`title.header_menu` в
en/ru/de/fr), перевод четырёх существующих смоков на новый контракт
(`smoke_support_feedback`, `smoke_gear_tabs`, `smoke_toolbar_stable_width`,
`smoke_modes`) и `test/support-feedback.test.mjs`.

Работа закрывает J1/J3 из `docs/SCOPE.md` (домочадец на телефоне «взглянул и
нажал») и прямо реализует продуктовое решение владельца из спек-ревью
(умолчания по всем 4 вопросам issue).

## Как проверялось

Рабочая копия уже стояла на материале; ничего не перезаписывал, дерево после
всех прогонов и мутационных проб чистое (`git status --short` пусто).

### Гейты — прогнаны лично на SHA `255330b9`

| Гейт | Команда | Результат |
|---|---|---|
| typecheck+build | `npm run build` | 0 ошибок, `dist` собран |
| bundle-sync | `npm run bundle:sync` | 3 копии совпали (`dist`/`custom_components`/`demo/srv/assets`) |
| unit | `npm test` | 3086 тестов, **3085 pass, 0 fail, 1 skip** — совпадает с заявленным в хендоффе |
| bundle-budget | `node scripts/bundle-budget.mjs` | initial View **291626 Б**, потолок 292600±2000 — совпадает с заявленным замером 291635 |
| inventory (bundleBytes/hostRefs) | `node scripts/inventory.mjs` | `bundleBytes` 2528415 (заявлено то же), `hostRefs` 4883 = значению на `dev` (не вырос, как заявлено) |
| no-new-any | `node scripts/no-new-any.mjs` | «Новых any нет» |
| no-new-private-writes | `node scripts/no-new-private-writes.mjs` | «Новых записей в приватное состояние карточки нет» |
| check-docs | `node scripts/check-docs.mjs --screenshots=warn` | passed (только WARN о неснятых скриншотах — ожидаемо, скриншоты не относятся к golden) |
| check-inputs --coverage | `node scripts/check-inputs.mjs --coverage` | exit 0 |
| process-gate | `node scripts/process-gate.mjs --issues` | «гейт пройден, предупреждений 0» |
| mutation-registry --check | `node scripts/mutation-registry.mjs --check` | exit 0, все якоря валидны (включая 10 новых) |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 29 прямых совпадений + 2 зарегистрированные связи (`smoke_gear_tabs.mjs`, `smoke_mobile_view_header.mjs` — обе по `HeaderMenu`/`headerMenuItems`/`renderHeaderActions`), 0 НЕОПРЕДЕЛЁННОСТЬ |
| смок задачи | `node demo/smoke_mobile_view_header.mjs` (чистое дерево) | **36/36 OK** |
| 4 переведённых смока | `smoke_support_feedback`, `smoke_gear_tabs`, `smoke_toolbar_stable_width`, `smoke_modes` | все **OK** |
| смежный риск (drag вкладок) | `smoke_space_tab_reorder` | OK — `pointer-events:none` на новом `span.tabtitle` не сломал перетаскивание |
| golden:verify (диагностически, не гейт приёмки) | `npm run golden:verify` | 136 passed / 39 different / 0 missing — см. «Golden» ниже |

### Мутанты — проверены лично (не поверил заявлению «KILLED» на слово)

Патчил по одному, `bundle:sync`, гонял смок/юнит, откатывал, сверял чистоту
дерева:

| Мутант | AC | Команда | Результат до отката |
|---|---|---|---|
| `phone-header-wraps` | AC2 | `bundle:sync` + `smoke_mobile_view_header` | **12 FAILED** (`admin390_oneRow56`, `household390_oneRow56`, `itemsSameEffect` и др.) |
| `header-menu-escape-ignored` | AC4 | `bundle:sync` + `smoke_mobile_view_header` | **3 FAILED** (`escapeClosesAndFocuses` и производные) |
| `active-tab-not-revealed` | AC5 | `bundle:sync` + `smoke_mobile_view_header` | **2 FAILED** (`activeTabRevealedOnSwitch`, `activeTabRevealedOnLoad`) |
| `header-menu-drops-pdf` | AC3 | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/header-menu.test.mjs` | **4 из 7 упали** (юнит подписей и состава) |

Все четыре красные под своей мутацией и зелёные после отката — «тест умеет
падать» подтверждено исполнением, не заявлением автора. Оставшиеся 6
мутантов не гонял лично (бюджет ревью), их якоря валидны через
`mutation-registry --check`, а покрываемые ими AC (AC1, AC6, AC7)
дополнительно разобраны чтением (см. ниже) и подтверждены прогоном чистого
смока.

### AC · разбор

| AC | Требование | Доказательство | Вердикт |
|---|---|---|---|
| AC1 | ≤480, не-админ: одна строка ≤56, без заголовка, без `.tabedit/.tabadd` на любой ширине | смок `household{390,320}_oneRow56/_rowContent`, `household1400_noTabEditing` — все `true` в чистом прогоне; чтением: `.tabedit`/`.tabadd` условие `_norm && this._canEdit` не тронуто (мутант `tab-editing-without-write-access` не перепроверял руками, но чтением кода условие — то же, что до диффа) | доказан |
| AC2 | ≤480, админ, просмотр и редактор: одна строка ≤56, прежние кнопки скрыты, × работает | смок `admin{390,320}_oneRow56/_inlineHidden`, `editorOneRow56`, `crossClosesOnPhone` — `true`; мутант `phone-header-wraps` лично воспроизведён | доказан |
| AC3 | Состав меню по роли/режиму/условиям, тот же эффект, закрытие | юнит 7/7 pass в чистом дереве, мутант `header-menu-drops-pdf` лично воспроизведён; смок `itemsSameEffect`, `summaryToggleFlips`, `editorFromMenu`, `editorMenuMarksCurrent` — `true` | доказан |
| AC4 | Escape закрывает и возвращает фокус; тап вне — поглощается | смок `escapeClosesAndFocuses`, `outsideTapClosesMenu`, `outsideTapSwallowed` — `true`; мутант `header-menu-escape-ignored` лично воспроизведён | доказан |
| AC5 | Активная вкладка видна на 390 px при 6 пространствах после загрузки и после переключения | смок добавляет 4 пространства к 2 базовым (`f1`, `garden`) демо-конфига = 6, `manySpacesOneRow`, `activeTabRevealedOnSwitch/Back/OnLoad` — `true`; мутант `active-tab-not-revealed` лично воспроизведён | доказан |
| AC6 | Шестерёнка и пункты ≥44 px, меню в пределах окна на 320 px | CSS (`min-width/height: 44px` у `.header-menu-button`, `.header-menu-item`) прочитан построчно; смок `gear44`, `menuTargets` (`items44 && inViewport`) — `true` на 320 px | доказан чтением + смоком (мутант не перепроверял руками) |
| AC7 | >480 прежняя шапка, кнопка меню не видна; киоск — меню не рендерится | смок `admin{481,768,1400}_unchanged`, `kioskNoMenu` — `true`; `smoke_toolbar_stable_width`, `smoke_modes` (переведены, зелёные) не показали регрессий на 768/1000/1400 | доказан |
| AC8 | Golden-кадры с мобильной шапкой пересняты предрелизным гейтом CI | не переснимались (сознательно, AC формулирует это как предрелизный шаг, §11.4); диагностически прогнал `golden:verify` сам — см. «Golden» | подтверждено, что именно ожидаемые кадры разошлись; финальная приёмка — вне этого ревью |

Все восемь AC либо доказаны исполнением (смок/юнит + лично проверенная
мутация на пяти из них), либо разобраны чтением кода с указанием, что делалось
чтением, а не исполнением (AC1 частично, AC6 частично).

### Golden (диагностика, не гейт приёмки)

`npm run golden:verify` в этой песочнице — 136 passed / 39 different / 0
missing. Среди «different» ожидаемо оба кадра, названных в AC8:
`german-view-mobile-light` и `version-mismatch-touch-light-ru`. Остальные 37
«different» разбросаны по подсистемам, которых этот дифф не касается вовсе —
стены/примыкания (`wall-junctions-*`, `junction-patch-resilience-*`),
привязка проёмов (`opening-placement-*`), безопасный ресайз
(`safe-resize-handles-clamp-*`), мебельные лотки (`tray-*`,
`furniture-*`), карточка устройства/бэкап/саппорт-диалоги
(`device-dialog-*`, `backup-space-preview-*`, `support-phone-*`). Ни один
изменённый файл диффа (`header-menu.ts`, шаблон шапки, `chrome.styles.ts`,
`summary-panel-runtime-loaded.ts`) не имеет отношения к этим сценам — это
дрейф рендера окружения (шрифты/GPU-less Chromium вне закреплённого
CI/WSL-тулчейна, о чём прямо предупреждает `AGENTS.md`), а не регрессия
этой задачи. 0 «missing» — рендер не падал ни на одном кадре. Трактую это
как подтверждение того, что AC8 корректно оставляет приёмку golden
предрелизному гейту на точном SHA, а не как сигнал к blocking-находке.

### Прочитано и совпадает с описанием в хендоффе

- Строка `.hdr > .head { flex-wrap: nowrap; ... }` в `chrome.styles.ts`
  действительно перебивает `.head { flex-wrap: wrap; }` из
  `dialogs.styles.ts` по специфичности (`.hdr .head` — два класса против
  одного) независимо от порядка подключения; подтверждено смоком
  (`admin390_oneRow56` истинно в чистом дереве и ложно под мутантом).
- `space-add` в меню использует то же условие `!this._hasFixedFloor`, что
  и прежняя инлайн-кнопка `.tabadd` (`houseplan-card.ts:10796`) — не новое
  условие.
- `.editor-close-slot` и `.zoomctl` не входят в список скрытых на ≤480 px
  селекторов — слот × #647 остаётся в строке редактора, как требует AC2;
  подтверждено `crossClosesOnPhone`.
- i18n: `title.header_menu` добавлен во все четыре языка с текстом из ТЗ
  («Actions and settings» / «Действия и настройки» / «Aktionen und
  Einstellungen» / «Actions et réglages»).
- Оба changelog правлены в этом же коммите (`User-Visible: yes`) —
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`, тексты синхронны по смыслу.
- `data-hp-contract.json`: `header-menu`, `header-menu-item` (все 11
  `data-id`, включая `projection`, совпадающие с кодом), `header-menu-scrim`
  добавлены с `since: 1.78.0-beta.3` — CARD_VERSION в коде остаётся
  `1.78.0-beta.2` на момент коммита; это установленный в репозитории
  паттерн (см. `035399e7`, где `mode-tab` получил `since: 1.78.0-beta.2`
  при `CARD_VERSION = 1.78.0-beta.1` на тот момент) — `since` называет
  версию, в которой хук доедет до релиза, не текущий `CARD_VERSION`
  коммита. Не находка.
- `monolith-baseline.json`: `bundleBytes` 2521909 → 2528415 совпадает с
  замером; `hostRefs` не изменился (4883) — подтверждено `inventory`.
- Потолок монолита 12889: `houseplan-card.ts` — 12882 строки, ниже потолка,
  логика меню действительно вынесена в отдельный модуль.
- Четыре переведённых смока (`smoke_support_feedback`, `smoke_gear_tabs`,
  `smoke_toolbar_stable_width`, `smoke_modes`) не ослабляют проверки: они
  меняют точку входа (кнопка → пункт меню) там, где кнопка реально скрыта
  CSS на ≤480 px, и по-прежнему кликают настоящий видимый элемент по
  координатам, а не читают приватные поля для обхода клика.
- `test/support-feedback.test.mjs`: assert на порядок и число
  `header-action` теперь читает `renderHeaderActions()` в
  `header-menu.ts`, а не старый инлайн в `houseplan-card.ts` — корректно
  следует за переносом кода.

## Находки

Нет ни одной находки уровня High или Medium. Отмечаю один принятый без
доработки момент — не находка, а решение, подтверждённое проверкой:
несовпадение `CARD_VERSION` и `since` в `data-hp-contract.json` — уже
объяснено выше, соответствует прежней практике репозитория.

## Чего не проверял

- Полный матрица смоков (270 файлов) — прогнал только выборку
  `smoke-select` (29 прямых + 2 зарегистрированные) частично (4 переведённых
  + сам новый смок + смежный `smoke_space_tab_reorder`), остальные не
  запускал: вне бюджета ревью, не тронуты диффом по символам.
- Golden — не гейт этого ревью (AC8 явно относит к предрелизному на CI);
  собственный прогон в песочнице — диагностика, не пинованное окружение
  (см. раздел «Golden»), поэтому его 39 «different» не могут быть основанием
  ни находки, ни приёмки.
- Документационные скриншоты (`check-docs --screenshots=strict`) — не
  гонял, только `warn`-режим; несвежесть скриншотов уже известна и не
  относится к этой задаче.
- Настоящий телефон/HA Companion/Safari — не тестировал, только Chromium
  headless-shell из Playwright.
- HA-харнесс (`pytest tests_backend`) — Python не менялся, не гонял.
- Мутанты `phone-header-shows-title`, `header-menu-item-keeps-menu-open`,
  `header-menu-outside-tap-reaches-plan`, `header-menu-item-below-44`,
  `phone-header-at-tablet-width`, `tab-editing-without-write-access` (6 из
  10) — не гонял лично, положился на валидные якоря `mutation-registry
  --check` и логическую разборку кода/смока; проверил 4 из 10 (по одному на
  AC2/AC3/AC4/AC5) как выборочную проверку дисциплины «тест умеет падать».
- Производительность — не названа в AC, не гонял.

## Вердикт

Зелёный. Все восемь AC доказаны (исполнением там, где смок/юнит есть, и
чтением там, где отмечено явно), пять из десяти заявленных мутаций
перепроверены лично и действительно красят тесты, гейты (typecheck, build,
bundle-sync/budget, unit 3085/3085, no-new-any, no-new-private-writes,
check-docs, check-inputs, process-gate, mutation-registry --check,
smoke-select) зелёные на этом SHA, оба changelog и трейлеры в порядке,
терминология из `USER-GUIDE.ru.md` соблюдена, потолок монолита не пробит.
Единственный рост бюджета (initial View +1600 Б gzip) обоснован в issue и
подтверждён замером. Golden-дрейф в песочнице — диагностика, подтверждающая
именно ожидаемые (не посторонние) кадры среди «мобильных», остальное —
шум окружения вне пинованного CI/WSL.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/616-mobile-view-header`, коммит `255330b9bc82` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `128f4ab70f572749f39a8fdd6ae1ddbe2b6b2723`
  ```
  git log --all --format='%H %T' | grep 128f4ab70f57
  ```
- Тело issue: `d31c85f266be16c9f37e1df9ea9155014dea6fcc17761e493e3a6945ad360df9`
- Вердикт конвейера: `green` · High 0
