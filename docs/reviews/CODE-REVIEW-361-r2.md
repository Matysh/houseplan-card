# CODE-REVIEW-361-r2

Issue: [#361](https://github.com/Matysh/houseplan-card/issues/361) — «Мебель: физическая толщина линий не масштабируется при zoom»
Этап: code · заход r2 · блокирующих циклов израсходовано 1/4 (зелёные вердикты бюджет не тратят, #227)
ТЗ: `docs/specs/361-furniture-stroke-zoom.md` (зелёный в SPEC-REVIEW-361-r2, SHA `31c6e77c`)

Раунд r1 код-ревью: жёлтый, SHA `4b273e94` (документ `docs/reviews/CODE-REVIEW-361-r1.md`,
единственная Medium-находка: golden-бейзлайны с реальной мебелью не приняты под новый
физический stroke).

Ветка приведена к `dev` конвейером до этого раунда: поверх легло 3 dev-коммита
(`8896d610 -> 737d2f66`, добавлены `c50d9e42`, `631bafea`, `00197a3a`, `23d6681d`,
`cbf9318e`, `f2e36572`, `7c45372c` — параллельные задачи #369/#366/#39, не #361). По §7.2
это другой код, и разбор ниже — **полный**, а не по дельте, несмотря на то что это
формально второй код-ревью-цикл.

## Скоуп проверки

Диапазон `origin/dev...HEAD`, 46 файлов. Продуктовый код — тот же, что уже был полностью
разобран в r1: `src/furniture.ts` (+55/-4), `src/houseplan-card.ts` (+30/-6), коммит
`6c608485` (`fix: scale furniture strokes with plan zoom`, trailers `Issue: #361` /
`User-Visible: yes`). Я построчно сверил оба файла с диффом, процитированным в
`CODE-REVIEW-361-r1.md`, — содержимое побайтово идентично тому, что уже прошло полный
разбор на `4b273e94`; сменился только SHA из-за двух последовательных ребейзов (сначала
ручной автором на `dev@23d6681d` после конфликта в generated bundle, затем конвейерный
перед этим ревью). Остальное — тесты, три копии бандла, документация, changelog,
docs-скриншоты и golden-бейзлайны.

Продуктовое рассуждение (сверено заново, не по памяти r1): задача закрывает строку **J6**
`docs/SCOPE.md` («Keep the plan true as the home evolves» — редактирование/drag/resize
существующих элементов плана должно оставаться физически достоверным) и косвенно **J4**
(создание плана «как физического объекта»). Диагноз (line/rect/ellipse получают физический
`stroke-width` без `vector-effect`, мебель — тот же `stroke-width`, но с принудительным
`non-scaling-stroke`, который одновременно гасит и локальный анизотропный transform, и
внешний camera zoom) подтверждён чтением кода заново, не переносится как готовый вывод.

Зелёного Validate на `737d2f66` нет — все гейты ниже прогнаны мной локально.

## Как проверялось

1. Прочитаны заново: весь diff `src/furniture.ts`/`src/houseplan-card.ts`, ТЗ, issue и все
   комментарии обоих SPEC-REVIEW и обоих CODE-REVIEW раундов, `docs/SCOPE.md` (J4/J6),
   `docs/FURNITURE.md`, `docs/USER-GUIDE.ru.md`.
2. Построчное сравнение текущего диффа `src/furniture.ts`/`src/houseplan-card.ts` против
   origin/dev с кодом, процитированным в `CODE-REVIEW-361-r1.md`: `furniturePlanScreenScale`,
   `furnitureStrokePx`, точки вызова в `_renderFurniturePlacementPreview` и
   `_renderDecorLayer` — идентичны знак в знак.
3. Дешёвые гейты (прогнаны сам, Validate на этом SHA не найден):
   - `npx tsc --noEmit` — **PASS**;
   - `npm test` — **1533 pass, 1 skip, 0 fail** (~26.5s, полный набор);
   - `npm run build` — чисто, `git status --short` пуст после сборки;
   - `npm run bundle:sync` — три копии бандла (`dist/`, `custom_components/houseplan/frontend`,
     `demo/srv/assets`) пересобраны, `git status --short` после — пуст, дифф с рабочим
     деревом нулевой;
   - `npm run bundle:budget` — **PASS**, initial View 273551 B gzip / budget 282000 B,
     запас 8449 B (запас чуть меньше, чем в r1 (9152 B), — за счёт трёх посторонних dev-
     коммитов, легших поверх при ребейзе, не этой задачи);
   - `node scripts/check-docs.mjs` (diff трогает `src/**`) — **PASS**, 7 файлов, 10 внешних
     ссылок;
   - `node scripts/no-new-any.mjs --base origin/dev --head HEAD` — **PASS**, 75 новых строк
     в 2 файлах, новых `any` нет.
4. `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — та же картина, что в r1:
   29 «прямых совпадений» по `_baseVb`/`_viewOr`/`_stageEl` (методы камеры/viewport, не
   изменены диффом, только читаются в новой ветке рендера мебели) и 1 «слабая связь»
   (`smoke_canvas_frame.mjs` ← `_baseVb`). Решение по каждой строке — как в r1: методы не
   изменены, ни pan/zoom/backdrop/kiosk/жесты/виртуальный свет к furniture-stroke отношения
   не имеют — не прогонялись; `smoke_canvas_frame.mjs` (слабая связь) просмотрен — про
   рамку вида/aspect, мебели не касается, не прогонялся.
5. Целевой смок из AC1/AC3/AC4/AC6: `node demo/smoke_furniture.mjs` → **OK**, все 90 полей
   `true`, включая растровые (`furnitureFollowsPhysicalCameraZoom`,
   `designerAndPrimitiveMatchOrdinaryDecor`, `anisotropicResizeKeepsBothAxesEqual`,
   `rotatedArtworkKeepsTheSameThickness`, `viewportResizeRecalculatesTheSharedPhysicalStroke`,
   `previewAndCommitShareThePhysicalStroke`).
6. **Дисциплина «тест должен уметь падать» — унаследована из r1, не переисполнена**: revert-
   проверка (откат `src/furniture.ts`/`src/houseplan-card.ts` к `origin/dev`, повторный
   прогон `furniture-stroke-contract.test.mjs` и `demo/smoke_furniture.mjs`, восстановление
   дерева) уже документирована в `CODE-REVIEW-361-r1.md` на побайтово идентичном коде.
   Гонять заново дорогой Chromium-revert-цикл ради кода, который я построчно сверил как
   идентичный, — трата времени без нового знания; см. раздел «Унаследовано из r1».
7. Golden baseline — находка r1. Проверил закрытие на факт-коде:
   - `git diff origin/dev...HEAD -- demo/golden/baselines/baselines-index.json` показывает,
     что изменены ровно 4 записи из ТЗ (`furniture-placement-preview-light`,
     `furniture-plan-art-dark`, `decor-over-opaque-hover-light`,
     `decor-over-glow-base-dark`) плюс `sourceFingerprint`/`acceptedAt`/`witnesses.count`
     (133→131, floor 10 — запас есть). Остальные 138 хешей не тронуты;
   - после `npm run bundle:sync` (чтобы `demo/srv/assets` был собран из факт-кода) прогнал
     `node demo/golden/run.mjs --mode=capture --scenario=<id>` для всех 4 сценариев →
     **`passed` на всех четырёх** (актуальный рендер совпадает с новым принятым бейзлайном);
   - контрольный прогон `furniture-categories-light` (мебель есть только в палитре,
     decor-слоя с реальной мебелью нет) дал `different` (`diffRatio≈0.00175` при пороге
     `0.0008`); чтобы отличить реальную регрессию от дрейфа среды, откатил
     `src/furniture.ts`/`src/houseplan-card.ts` к `origin/dev`, пересобрал (`bundle:sync`) и
     повторил тот же сценарий — **тот же `actualSha256`, тот же `diffRatio`**, то есть
     расхождение существует независимо от этого фикса (предсуществующий дрейф рендеринга,
     не тронутый диффом) — не находка. После проверки восстановил рабочее дерево (`cp`
     оригиналов + `git reset HEAD`, `git diff HEAD` пуст) и пересобрал бандл;
   - `npm run golden:verify` целиком (182 сценария) не запускался: инструмент сам запрещает
     `--scenario` в режиме `verify` («golden verify must run the complete matrix»), а diff не
     трогает ничего вне decor/furniture render — остальные сценарии не имеют мебели в
     decor-слое и не могут пострадать от этого diff (то же обоснование, что в r1).
8. `npm run invariants` не прогонялся: `git diff origin/dev...HEAD --stat -- src/` показывает
   только `src/furniture.ts` и `src/houseplan-card.ts`, ни один не пишет и не читает
   `WallSegmentModel`/рёбра комнат/`layout`/`marker.space`/`open_spans` — только
   decor/furniture render (перепроверено чтением обеих новых функций и их точек вызова).
9. `python -m pytest tests_backend` не прогонялся: diff не трогает `custom_components/**/*.py`
   (только сгенерированные frontend-бандлы внутри `custom_components/houseplan/frontend/`).
10. Performance-профили не прогонялись: AC8 не называет конкретный профиль; source-contract
    тест (`test/furniture-stroke-contract.test.mjs`) мутационно гарантирует, что
    `furnitureScreenScale` резолвится один раз на весь decor-слой, не на предмет.
11. «Одно число — один источник»: физическая толщина мебели вычисляется один раз
    (`furnitureScreenScale` в `_renderDecorLayer`) и передаётся параметром в
    `_renderFurniturePlacementPreview` — единственная точка получения
    `furnitureStrokePx(...)` для preview и единственная для saved-пути; второго независимого
    вычисления той же видимой величины нет (проверено чтением: `houseplan-card.ts:8095-8098`,
    `8171`, и мутационно — `furniture-stroke-contract.test.mjs` требует ровно одно вхождение
    `const furnitureScreenScale = furniturePlanScreenScale(`). `test/single-source-numbers.test.mjs`
    эту величину не называет явно, но входит в зелёный `npm test` и не задет диффом.

## Закрытие раунда r1

| Находка r1 (Medium, в скоупе) | Чем закрыта | Где это видно |
|---|---|---|
| Golden-бейзлайны 4 сценариев с реальной мебелью (`furniture-plan-art-dark`, `furniture-placement-preview-light`, `decor-over-opaque-hover-light`, `decor-over-glow-base-dark`) не обновлены под новый физический stroke; `npm run golden:verify` упал бы на SHA `4b273e94`. | Коммит `737d2f66` (`test: accept furniture stroke golden baselines`, trailers `Issue: #361` / `User-Visible: no` / `Baseline-Reviewed: <CI run 33240556186>`) принимает ровно эти 4 хеша через `npm run golden:accept -- --reviewed` из полного Linux CI-артефакта; остальные 138 бейзлайнов не тронуты. | `git diff origin/dev...HEAD -- demo/golden/baselines/baselines-index.json` — 4 изменённых записи; `node demo/golden/run.mjs --mode=capture --scenario=<id>` → `passed` на всех четырёх на факт-коде (раздел «Как проверялось», п.7). |

Других находок r1 не было (High: 0, Medium: 1 — закрыта выше).

## Унаследовано из r1

Со ссылкой на `docs/reviews/CODE-REVIEW-361-r1.md`, SHA `4b273e94`:

- **Falsifiability-проверка новых тестов и смока** (revert `src/furniture.ts`/
  `src/houseplan-card.ts` к `origin/dev`, повторный прогон
  `test/furniture-stroke-contract.test.mjs` и `demo/smoke_furniture.mjs`, наблюдение падения
  ровно на ожидаемых утверждениях, восстановление дерева) — не переисполнена в этом раунде.
  Основание: я построчно сверил текущий `src/furniture.ts`/`src/houseplan-card.ts` с кодом,
  процитированным в r1, — содержимое идентично; повторный дорогой Chromium-revert-цикл на
  неизменившемся коде не добавляет знания.
- **Разбор нетипичного iso-случая** (`_baseVb()` → `!showBorders`/no-borders ветка, где
  `furnitureScreenScale` считается от `planView`, а фактический viewBox decor-слоя иногда
  берётся из `floorView`) — переперечитан мной в этом раунде (те же строки
  `houseplan-card.ts:11087-11090`, тот же вывод: оба входа конечны и положительны,
  `NaN`/пропажа мебели невозможны, численная калибровка iso вне контракта #361) —
  формально не «унаследовано без проверки», а подтверждено заново, привожу здесь для
  полноты трассировки.
- **Продуктовый диагноз и AC1…AC9 как таковые** (что чинить, что не входит в скоуп) —
  установлены на этапе SPEC-REVIEW-361-r2 (SHA `31c6e77c`, зелёный); в этом раунде я не
  оспаривал сам контракт, а проверял, что реализация ему соответствует.

## Проверено и корректно (по AC)

- **AC1/AC3 (физический zoom, rotate+zoom):** `furniturePlanScreenScale` — точная формула
  ТЗ `min(viewportW/viewBoxW, viewportH/viewBoxH)`, учитывает letterboxing. Растровый смок
  подтверждает кратное изменение толщины при переходе zoom1→zoom2 для designer- и primitive-
  артворка, включая повёрнутый на 30°.
- **AC2 (анизотропный resize):** `furnitureStrokePx` не принимает `w`/`h`/`viewW`/`viewH`
  предмета вообще — анизотропии неоткуда взяться; смок подтверждает равенство толщины по
  осям в пределах допуска.
- **AC4 (preview/commit parity):** один расчёт `furnitureScreenScale` на весь decor-слой,
  передан параметром в preview — единый источник для обоих render-путей; source-contract
  тест запрещает preview обходить `furnitureStrokePx`; смок
  `previewAndCommitShareThePhysicalStroke: true`.
- **AC5 (совместимость):** полный `npm test` зелёный (1533/1533, все 56 symbols, erase-hit,
  `data-hp`/`data-kind`/`data-symbol` не задеты); смок целиком (палитра, drag, resize,
  rotate, wall magnet, erase) зелёный.
- **AC6 (layout safety):** юнит-тесты на нулевые/`NaN`/`Infinity` входы всегда возвращают
  конечное число; смок `viewportResizeRecalculatesTheSharedPhysicalStroke` подтверждает
  пересчёт после ресайза viewport.
- **AC7 (поддерживаемые поверхности), кроме golden:** рендер общий для View/kiosk/
  Background editor, light/dark не входят в расчёт (проверено чтением); golden — закрыт
  выше отдельным разделом. Один нетиповой iso-случай разобран как явно принятый остаточный
  риск (раздел «Унаследовано из r1»), не находка.
- **AC8 (perf/bundle):** typecheck/test/build/bundle:sync/bundle:budget зелёные;
  `furnitureScreenScale` — один вызов на слой, гарантировано мутационным тестом.
- **AC9 (документация):** `docs/FURNITURE.md` больше не приписывает `non-scaling-stroke`
  физическую толщину; оба changelog обновлены в том же коммите `6c608485`
  (`User-Visible: yes`); `docs/USER-GUIDE.ru.md` — одно согласованное с разделом предложение.

## Чего не проверял

- Полный `npm run golden:verify` (182 сценария) — режим `verify` не допускает фильтр по
  сценарию, а прогнать все 182 ради diff, трогающего только decor/furniture render, —
  несоразмерная трата времени; прогнаны 4 названных в находке r1 сценария плюс 2 контрольных
  (`furniture-categories-light`, `tray-narrow-tool-ru`), с явным разбором «различие или
  дрейф среды» для контроля.
- Falsifiability revert-check новых тестов/смока — не переисполнена, см. «Унаследовано из
  r1» с обоснованием.
- Полная browser-smoke матрица (201 файл) — прогнан целевой `smoke_furniture.mjs`; связи,
  названные `scripts/smoke-select.mjs`, разобраны построчно (раздел «Как проверялось», п.4).
- `npm run invariants` — diff не геометрический (обоснование в п.8).
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py` (п.9).
- Performance-профили/бенчмарки — не названы в AC, риск закрыт чтением и мутационным тестом.
- Ручное тестирование в браузере человеком — не проводилось; весь цикл проверен автоматикой
  и чтением кода, как предписано процессом для код-ревью.

## Вывод

Код и тесты в этом раунде — тот же, уже полностью разобранный в r1, продукт содержательно
не изменился, изменился только SHA из-за ребейза на ушедший вперёд `dev`. Единственная
Medium-находка r1 (непринятые golden-бейзлайны) закрыта точно предписанным в ТЗ способом:
4 названных сценария приняты из полного Linux CI-артефакта, `passed` подтверждён локальным
`--mode=capture` прогоном на факт-коде, контрольные сценарии показывают только
предсуществующий дрейф среды, не связанный с этим диффом. Новых находок нет.

**High: 0 · Medium: 0 → в задаче**
