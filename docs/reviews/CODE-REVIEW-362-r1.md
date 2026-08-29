# CODE-REVIEW-362-r1

Issue: #362 · Заход: r1 · Трек: `small` (лимит циклов код-ревью — 2, §5) ·
Вердикт: **зелёный** · блокирующих циклов израсходовано 0/2

Ветка `issue/362-decor-device-inert`. Хендофф был на `fafd3601`; конвейер
привёл ветку к `dev` перед ревью (поверх легло 3 коммита `dev`,
`fafd3601 → f57a0c08`, вершина `f57a0c08` "fix: make devices inert in the
Background editor"). Ветка полностью содержит `origin/dev`
(`merge-base(HEAD, origin/dev) == origin/dev`), т.е. это честный fast-forward
rebase без потери коммитов. Разбор — полный (это первый заход, и рёбейз того
требует по §7.2 в любом случае).

## Скоуп

Контракт (тело issue, small-track ТЗ, зелёное спек-ревью r1): в редакторе
Подложка (`mode-decor`) вся presentation-subtree устройства (ядро, 44px
псевдо-хит-область, shell/frame, капсула значения, LQI/бейджи, pulse,
opening-lock сателлиты) должна быть инертна к hit-testing, а нажатие в той же
точке — доставаться активному инструменту Подложки. View и Устройства не
меняются. Задача входит в J4/J6 (`docs/SCOPE.md`) и восстанавливает
инвариант, уже задокументированный в `docs/DECOR-EDITOR.md` (opacity 0.35,
устройства вне magnet targets).

## Как проверялось

Дешёвые гейты (обязательны всегда, прогнаны на `f57a0c08`):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Unit | `npm test` | PASS — 1511 passed, 1 skipped, 0 failed (`# tests 1512`) |
| Build + bundle sync | `npm run build && npm run bundle:sync`, затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | PASS, три копии бандла побайтово идентичны |
| any-бюджет | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | PASS — «Новых any нет» (32 добавленные строки в 2 файлах) |
| Whitespace | `git diff --check origin/dev...HEAD` | PASS, без вывода |
| Docs fingerprint | `node scripts/check-docs.mjs` (обязателен — diff трогает `src/**`) | **RED** ожидаемо: `ERROR screenshot source fingerprint is stale`. Проверено сравнением: тот же гейт на `origin/dev`@`9431a5ce` (временный `git worktree`, чистая сборка) — **PASS** («Documentation checks passed»). Значит, стал stale именно из-за этой задачи. Это не эквивалент #230/#234 (там шаг вообще не прогоняли и находка терялась): отпечаток считается по всему `src/**`, поэтому *любая* правка фронтенда обязана его инвалидировать — «выбирать тут нечего» (см. текст задания ревью). Пересъёмка — отдельная джоба `Docs screenshots` (`workflow_dispatch`) с последующим `npm run docs:accept -- --reviewed`, коммит делает человек (`PROCESS.md` §8); это не часть цикла реализации и не повод для жёлтого вердикта, но обязана быть сделана до релиза — фиксирую как открытый пункт для релиз-менеджера, а не как находку к этому issue. |

По необходимости (определено diff'ом и AC):

- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — выборка:
  **прямое совпадение (12)**: `smoke_decor.mjs`, `smoke_inert_openings.mjs`,
  `smoke_isometric_live_touch.mjs`, `smoke_modes.mjs`,
  `smoke_space_settings.mjs`, `smoke_esc_dialogs.mjs`, `smoke_feedback_v2.mjs`,
  `smoke_lock_action.mjs`, `smoke_open_passage.mjs`,
  `smoke_opening_binding.mjs`, `smoke_registryless_opening.mjs`,
  `smoke_touch_tips.mjs`; плюс 29 «слабых» (одно распространённое имя —
  `_mode`/`stopPropagation`), решение по ним — не гонять: диф не трогает то
  поведение, о котором они спорят (wall/room/cover/furniture инструменты вне
  Подложки), совпадение по имени случайно.
  Прогнаны все 12 прямых (свежий бандл, `node demo/<name>.mjs` каждый) —
  **все PASS**, включая `smoke_decor.mjs`, обновлённый этой задачей.
  Опенинг-смоки (`smoke_inert_openings`, `smoke_lock_action`,
  `smoke_esc_dialogs`, `smoke_open_passage`, `smoke_opening_binding`,
  `smoke_registryless_opening`) прогнаны специально: правка тронула JS-гвард
  `.oplock`-обработчика клика (см. находку Low ниже), эти смоки — прямая
  regression-проверка того, что `View`-поведение замка (`_openingInfo`,
  диалог) не сломано. `smoke_modes.mjs` подтверждает регрессии нет в
  `Devices` (`devDragWorks`, `devClickOpensEditor` — оба true).
- `npm run golden:verify` — **не гонялся**. Diff не меняет ни одного
  painted-свойства: `opacity`/цвет/geometry устройств не тронуты, единственное
  новое CSS-свойство — `pointer-events`, которое не участвует в растеризации.
  Единственная удалённая строка (`.stage.mode-decor .oplock { pointer-events:
  none }`) была вычислительно избыточна и до правки: базовое правило `.oplock`
  уже задаёт `pointer-events: none`, `auto` включается только
  `.stage.mode-view .oplock` — вычисленное значение в `mode-decor` не
  изменилось. AC4 в самом ТЗ также утверждает «golden без переприёмки».
- `python -m pytest tests_backend` — не гонялся, diff не трогает
  `custom_components/**/*.py`.
- `node scripts/model-invariants.mjs` — не гонялся, diff не меняет геометрию,
  `layout`, `marker.space` или `open_spans`.
- performance-профили — не названы в AC, не гонялись.

**«Одно число — один источник»**: диф не вводит и не меняет ни одной новой
пользовательской величины. Единственное число рядом с изменением — opacity
`0.35`, которое уже было односточником через `architectureOpacity` в
`_modeVisualState`/`houseplan-card.ts:1212,1394`, потребляемое CSS-переменной
`--hp-mode-architecture-opacity`; эта задача её не трогает.

### Тест умеет падать — проверено фактическим ревертом, не заявлением

Дважды откатывал часть фикса на рабочем дереве (сборка, прогон смока/юнита,
затем восстановление файла из бэкапа, повторная сборка и `cmp` трёх копий
бандла — дерево вернулось чистым, `git status` пуст):

1. Откат CSS-правила `.stage.mode-decor .devlayer, .stage.mode-decor
   .devlayer *, .stage.mode-decor .dev::before` к старому
   `.stage.mode-decor .devlayer { pointer-events: none; }` →
   `node demo/smoke_decor.mjs` **упал** на трёх ассертах:
   `decorDeviceCoreFallsThrough`, `decorDeviceCapsuleFallsThrough`,
   `decorDeviceSubtreeIsPointerInert` (ожидалось true, получено false).
2. Откат гварда в `_pointerDown` к старому `if (this._mode === 'plan')
   return;` → `node demo/smoke_decor.mjs` **упал** на 10 ассертах:
   `decorDeviceHandlersFailClosed`, `lineStartsThroughDeviceCapsule`,
   `rectStartsThroughDeviceCore`, `textStartsThroughDeviceCore`,
   `furniturePlacesThroughDeviceCore` и 5 каскадных (`lineToolStartsDraft` и
   др. — устройство перехватило `_drag`, что сломало последующие проверки
   инструментов).

`test/device-marker-polish-contract.test.mjs` — новый юнит-тест регексами
сверяет ровно те же строки кода (CSS-правило, порядок гварда/`stopPropagation`
в `_clickDevice`, гварды `_pointerDown/_pointerMove/_pointerUp`, условия в
`@pointerover`/`@pointermove`); ревертнутые выше строки буквально не совпали
бы с этими регексами — падение подтверждено тем же способом, без отдельного
повторного прогона.

## AC — разбор

| AC | Статус | Доказательство |
|---|---|---|
| AC1 (hit-testing инертен для ядра/капсулы) | **Выполнен** | `smoke_decor.mjs`: `decorDeviceCoreFallsThrough`, `decorDeviceCapsuleFallsThrough`, `decorDeviceSubtreeIsPointerInert` — true; подтверждено умением падать (см. выше). CSS-специфичность проверена чтением: `.stage.mode-decor .devlayer *` (0,2,0) бьёт одноклассовые `.dev`/`.device-shell-frame` `pointer-events: auto` (0,1,0) в `devices.styles.ts:144,213`; `::before` — отдельным явным селектором, т.к. `*` не матчит псевдоэлементы. |
| AC2 (Line/Rect/Text/Furniture сквозь устройство) | **Выполнен** | `smoke_decor.mjs`: `lineStartsThroughDeviceCapsule`, `rectStartsThroughDeviceCore`, `textStartsThroughDeviceCore`, `furnitureToolArmedThroughDeviceCore`+`furnitureTargetFallsThroughDeviceCore`+`furniturePlacesThroughDeviceCore` — все true. Умение падать подтверждено (пункт 2 выше). |
| AC3 (нет device-побочных эффектов) | **Выполнен** | `decorDeviceHandlersFailClosed` (serviceCalls=0, wsCalls=0, `_tip`/`_infoCard`/`_drag` не выставлены) при прямом dispatch pointerover/pointerdown/click — true. Прочитан код: `_clickDevice`/`_pointerDown` возвращают до какого-либо побочного эффекта при `_mode ∉ {view, devices}`; `_pointerMove`/`_pointerUp` (drag/selection/`_savePos`) — гвард `_mode !== 'devices'`; long-press таймер живёт только в view-ветке `_pointerDown`, недостижим в Background. |
| AC4 (opacity 0.35 стабилен, смена инструмента не меняет пассивность) | **Выполнен** | `decorDeviceLayerIsTranslucent` (opacity≈0.35) — true; core/capsule fall-through и through-device постановка проверены при 4 разных `_decorTool` (line/rect/text/furniture). Golden не переприёмывался — обоснование в разделе «как проверялось» (paint не меняется). |
| AC5 (View/Devices не деградировали) | **Выполнен** | Регрессионные смоки: `smoke_decor.mjs` `visibleInView`/`inertInView` (для decor-фигур, не устройств — существующий несвязанный ассерт, не трогался); `smoke_modes.mjs` `devDragWorks`/`devClickOpensEditor` — true (Devices editor). View-специфичный `_pointerDown`-путь (long-press → `_infoCard`) не тронут кодом (ветка `if (this._mode === 'view')` идёт первой и делает `return` до нового гварда — гвард лишь сузил, какие ещё режимы доходят дальше). Opening-lock смоки (6 штук, список выше) — все PASS, без регрессии `_openingInfo`/View-клика. |
| AC6 (нет config/i18n/perf/touch изменений) | **Выполнен** | `git diff --stat` — только `src/houseplan-card.ts`, `src/styles/plan.styles.ts`, `demo/smoke_decor.mjs`, `test/*.mjs`, `docs/*`, бандлы; ни одного i18n/schema файла. Новых listener/observer/render-путей нет — все изменения это ранние `return` внутри уже существующих обработчиков плюс чисто декларативный CSS-каскад. Pointer/pen/touch не различаются нигде в изменённом коде (`PointerEvent`-путь общий для всех `pointerType`), поэтому инертность автоматически распространяется на все типы указателя без отдельного touch-контракта. |

## Находки

### Low — верифицировано чтением, фикс не требуется

`_openingInfo`-обработчик клика по `.oplock` (`src/houseplan-card.ts`,
`@click` в `_renderOpeningLocks`) получил тот же паттерн гварда
(`if (this._mode !== 'view') return;` до `stopPropagation()`), хотя контракт
ТЗ явно называет «opening-lock satellites» частью инертной subtree (пункт 1),
а сам AC1 в таблице доказательства называет только `.dev`/`::before`/
`.device-shell-frame`/capsule — без oplock. Ни один AC, ни новый блок
`smoke_decor.mjs` не проверяют это напрямую для `mode-decor`.

Прочитано и проверено: `.oplock` уже до этой задачи имел базовое
`pointer-events: none` (`dialogs.styles.ts:167`, комментарий «inert while
editing; clickable in View (rule below)»), и `auto` включался только
`.stage.mode-view .oplock` (`plan.styles.ts:488`). То есть в реальном браузере
хэндлер и до, и после правки недостижим кликом мыши/тача в `plan`/`devices`/
`decor` — CSS уже резал hit-testing независимо от этой задачи. Изменение —
чисто defense-in-depth, симметричное остальному фиксу (контрактный пункт 6:
«не полагаться только на `pointer-events: none` родителя»), и не меняет
наблюдаемое поведение ни в одном режиме. 6 opening-related смоков (список
выше) подтверждают отсутствие регрессии в View. Не блокирует: находка не
меняет функциональность и не требует правки в этом issue.

### Не найдено High/Medium

Ни одного High. Ни одного Medium — ни в скоупе, ни вне его. Новый issue не
заводится.

## Что проверено и корректно

- Двойная защита (CSS-каскад + fail-closed JS-гварды) реализована так, как
  требует контракт: ни один слой не полагается только на другой.
- CSS-специфичность нового правила действительно перебивает все три
  `pointer-events: auto` в `devices.styles.ts`, включая псевдоэлемент
  `::before`, отдельно вынесенный, поскольку универсальный селектор `*` его
  не матчит.
- Гварды в обработчиках копируют структуру существующего `_ctxDevice`
  (правый клик — уже был fail-closed вне View до этой задачи, не тронут) —
  согласованный паттерн по всей поверхности.
- `_keyDevice` (клавиатурная активация) уже был защищён гвардом `_mode
  !== 'view' && _mode !== 'devices'` до этой задачи — не тронут, риска нет
  (в Background `tabindex` не проставляется, элемент не фокусируем).
- И новый юнит-тест, и новый блок смока проверены на умение падать прямым
  ревертом кода (см. выше) — не приняты на слово автора.
- Терминология CHANGELOG/DECOR-EDITOR.md сверена с `docs/USER-GUIDE.ru.md`
  и `docs/USER-GUIDE.md` («Подложка»/Background editor) — совпадает.
- Трейлеры коммита `f57a0c08`: `Issue: #362`, `User-Visible: yes` — оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же
  коммите.
- Три копии бандла (`dist`, `custom_components/.../frontend`,
  `demo/srv/assets`) побайтово идентичны после `npm run bundle:sync`.

## Чего не проверял

- `npm run golden:verify` и `pytest tests_backend` — не гонялись, обоснование
  выше (diff не меняет paint и не трогает Python).
- Полный набор `demo/smoke_*.mjs` (не выборка) — не гонялся, диф не задевает
  геометрию/стены/проёмы вне уже прогнанных opening-смоков; полный набор —
  предрелизный гейт.
- Performance-профили — не названы в AC, не запускались.
- Пересъёмка docs-скриншотов (гейт `docs` в CI) — не выполнялась и не может
  быть выполнена в этом цикле (нужна выделенная джоба `Docs screenshots` на
  точном Chromium плюс `--reviewed`-приёмка человеком); зафиксировано выше как
  открытый пункт для релиз-менеджера, не как находка к этому issue.
