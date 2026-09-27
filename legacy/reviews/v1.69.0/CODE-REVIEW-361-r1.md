# CODE-REVIEW-361-r1

Issue: [#361](https://github.com/Matysh/houseplan-card/issues/361) — «Мебель: физическая толщина линий не масштабируется при zoom»
Этап: code · заход r1 · блокирующих циклов израсходовано 0/4 до этого раунда
ТЗ: `docs/specs/361-furniture-stroke-zoom.md` (принято зелёным в SPEC-REVIEW-361-r2)
Ветка: `issue/361-furniture-stroke-zoom`, SHA после ребейза на dev: `0dd24b1e` (было `4b273e94`, поверх легло 1 dev-коммит; по §7.2 разбор полный)
Коммит реализации: `0dd24b1e` — `fix: scale furniture strokes with plan zoom` (trailers `Issue: #361`, `User-Visible: yes`)

## Скоуп проверки

Один продуктовый коммит `0dd24b1e`, диапазон `origin/dev...HEAD` (40 файлов, из них
продуктовый код — `src/furniture.ts` (+55/-4), `src/houseplan-card.ts` (+30/-6);
остальное — тестовые файлы, три копии бандла (`dist/`, `custom_components/houseplan/frontend/`,
`demo/srv/assets` пересобирается локально), документация, changelog и docs-скриншоты.
Зелёного Validate на `0dd24b1e` не найдено — все гейты ниже прогнаны мной локально.

Продуктовое рассуждение: задача точно закрывает Core user job «мебель ведёт себя как
физический элемент плана» (администратор дома размещает/просматривает мебель, физическая
толщина контура должна масштабироваться с планом, как остальной decor). Диагноз и контракт
не догадка — оба уже проверены по коду на этапе SPEC-REVIEW и подтверждаются здесь ещё раз
по фактическому диффу.

## Как проверялось

1. Прочитан весь diff `src/furniture.ts`/`src/houseplan-card.ts`, ТЗ
   `docs/specs/361-furniture-stroke-zoom.md`, issue и все комментарии (включая оба раунда
   SPEC-REVIEW).
2. Прочитан контекст вокруг изменений: `_stageEl`, `_baseVb`, `_viewOr`, `_floorView`,
   существующий прецедент того же приёма (`perUnit = stage.clientWidth / view.w`,
   houseplan-card.ts:10643) и CSS (`plan.styles.ts`: `.zoomwrap > svg { width:100%; height:100% }`,
   `.stage { width:100% }`) — подтверждает, что `stage.clientWidth/clientHeight` корректно
   прокси размеру фактического SVG-viewport, как и в остальном коде.
3. Прогнаны дешёвые гейты сам (Validate на этом SHA не найден):
   - `npx tsc --noEmit` — **PASS**;
   - `npm test` — **1521 pass, 1 skip, 0 fail** (полный набор, единичный запуск ~23s);
   - `npm run build` + сверка трёх копий бандла (`git status --short` после `npm run build`
     и отдельно после `npm run bundle:sync`) — **чисто, дифф пуст**, три копии синхронны;
   - `node scripts/check-docs.mjs` (diff трогает `src/**`) — **PASS** (7 файлов, 10 внешних
     ссылок; отпечаток скриншотов принят вместе с обновлёнными `docs/images/*.png` в этом
     же коммите);
   - `npm run bundle:budget` — **PASS** (272848 B / 282000 B, запас 9152 B);
   - `node scripts/no-new-any.mjs --base origin/dev --head HEAD` — **PASS** (75 новых строк,
     новых `any` нет).
4. Дисциплина «тест должен уметь падать» применена к обоим новым тестовым файлам и к
   `demo/smoke_furniture.mjs`: временно откатил `src/furniture.ts` и `src/houseplan-card.ts`
   к версии `origin/dev` (тестовые файлы оставил новыми), пересобрал бандл и прогнал:
   - `node --test test/furniture-stroke-contract.test.mjs` → падает ровно на утверждении
     про `stroke-width=${strokeWidth}` в preview (ожидаемо: pre-fix preview использует
     `decorCmToUnits` напрямую, без `furnitureStrokePx`);
   - `node demo/smoke_furniture.mjs` → падает на `furnitureFollowsPhysicalCameraZoom: false`
     и `designerAndPrimitiveMatchOrdinaryDecor: false` — ровно тот дефект, который чинит
     задача.
   После проверки восстановил оба файла (`git diff HEAD` пуст) и пересобрал бандл заново —
   рабочее дерево совпадает с `HEAD` побайтово.
5. Прогнан целевой браузерный смок из AC1/AC3/AC4/AC6 на факт-коде:
   `node demo/smoke_furniture.mjs` → **OK**, все 90 полей `true`, включая растровые
   assertions (`furnitureFollowsPhysicalCameraZoom`, `designerAndPrimitiveMatchOrdinaryDecor`,
   `anisotropicResizeKeepsBothAxesEqual`, `rotatedArtworkKeepsTheSameThickness`,
   `viewportResizeRecalculatesTheSharedPhysicalStroke`). Смок меряет реальные пиксели через
   `getScreenCTM`+canvas, а не только DOM-атрибуты — доказательство не тавтологично.
6. `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — вывод: 29 «прямых
   совпадений» по символам `_baseVb`/`_viewOr`/`_stageEl` плюс 3 «зарегистрированные связи»
   по `_stageEl`, и 1 «неопределённость» (`smoke_canvas_frame.mjs` ← `_baseVb`). Решение по
   каждой строке — ниже, отдельным разделом.
7. Инварианты модели (`npm run invariants`) не прогонялись: diff не трогает рёбра комнат,
   записи толщины стен, `layout`, `marker.space` или `open_spans` — только decor/furniture
   render. Основание: `git diff --stat` не содержит файлов геометрической модели, а
   изменённые функции (`furniturePlanScreenScale`, `furnitureStrokePx`) не пишут и не читают
   ничего из `WallSegmentModel`.
8. `python -m pytest tests_backend` не прогонялся: diff не трогает `custom_components/**/*.py`
   (только сгенерированные frontend-бандлы внутри `custom_components/houseplan/frontend/`).
9. Performance-профили не прогонялись: AC8 не называет конкретный профиль, а по коду видно,
   что `furnitureScreenScale` вычисляется один раз на весь decor-слой
   (`houseplan-card.ts:8096`), не на предмет — подтверждено также тестом
   `furniture-stroke-contract.test.mjs` («the viewport scale is resolved once for the whole
   decor layer»).
10. `npm run golden:verify` — diff меняет видимый render (AC1 в самой сути — экранная
    толщина мебели), поэтому гейт обязателен. Полный прогон (182 сценария) не запускался
    целиком по времени; вместо этого сделан целевой прогон `--mode=capture --scenario=<id>`
    (единственный режим, допускающий фильтр — `verify` фильтр запрещает) по каждому
    сценарию, где decor-слой рисует реальную мебель, и по контрольным сценариям без мебели.
    Результат и его значение — в находке ниже.

## Находка (Medium, в скоупе)

**Golden-бейзлайны с реальной мебелью не обновлены под новый физический stroke; `npm run
golden:verify` в CI job `golden` (`.github/workflows/validate.yml:502`) упадёт на этом SHA.**

Четыре сценария `demo/golden/matrix.mjs` рисуют мебель (`kind: 'furniture'`) в основном
decor-слое, а не только в палитре: `furniture-plan-art-dark`, `furniture-placement-preview-light`,
`decor-over-opaque-hover-light`, `decor-over-glow-base-dark`. Задача правильно меняет
экранную толщину этой мебели (это и есть цель AC1/AC2), но ни один PNG в
`demo/golden/baselines/` не тронут этим коммитом (`git diff origin/dev...HEAD -- demo/golden/baselines`
— пусто), и `npm run golden:accept` в коммите не запускался.

**Воспроизведение** (после `npm run bundle:sync`, чтобы `demo/srv/assets` был собран из
факт-кода):

```
$ node demo/golden/run.mjs --mode=capture --scenario=furniture-plan-art-dark
different         furniture-plan-art-dark
# report: differingPixels=2820, diffRatio≈0.0036 (порог 0.0005), maxObservedDelta=35

$ node demo/golden/run.mjs --mode=capture --scenario=furniture-placement-preview-light
different         furniture-placement-preview-light
# differingPixels=995, diffRatio≈0.0014

$ node demo/golden/run.mjs --mode=capture --scenario=decor-over-opaque-hover-light
different

$ node demo/golden/run.mjs --mode=capture --scenario=decor-over-glow-base-dark
different
```

Контроль на исходном (`origin/dev`, без фикса) коде — тот же сценарий, тот же бейзлайн:

```
$ git checkout origin/dev -- src/furniture.ts src/houseplan-card.ts && npm run bundle:sync
$ node demo/golden/run.mjs --mode=capture --scenario=furniture-plan-art-dark
passed             furniture-plan-art-dark
# actualSha256 == baselineSha256, differingPixels=0, diffRatio=0
```

т.е. на `dev` этот сценарий побитово совпадает с бейзлайном, а после фикса — нет. Диф не
шум окружения (тот же контроль на сценарии без мебели, `furniture-categories-light`,
даёт идентичный `actualSha256`/`diffRatio` что на факт-коде, что на `dev` — это
предсуществующий дрейф среды рендеринга, а не эффект задачи, и он не входит в находку).

**Почему это Medium, а не High:** сам код корректен — растровый смок и юнит-тесты доказывают
именно то поведение, которое требует ТЗ; расхождение с golden — ожидаемое следствие
исправленного дефекта, а не побочная порча. Обязательный ремонт («если меняется видимый
результат — принять новый бейзлайн через `npm run golden:accept -- --reviewed` из полного
Linux CI artifact») уже прямо прописан в разделе «Release-артефакты» самого ТЗ (§361) —
находка целиком в скоупе задачи и чинится без изменения кода: прогнать реальный CI
Validate на этой ветке, вооружить golden-artifact и принять новые бейзлайны для этих 4
сценариев (`--expect-change=furniture-plan-art-dark,furniture-placement-preview-light,decor-over-opaque-hover-light,decor-over-glow-base-dark`
или как назовёт их сам скрипт), затем закоммитить обновлённые PNG вместе с этим фиксом.
Без этого шага `dev` получит красный job `golden` сразу после мержа — тот же класс
проблемы, что #230/#234 оставили с job `docs`.

## Решение по smoke-select

- 29 «прямых совпадений» (`_baseVb`, `_viewOr`, `_stageEl`) — эти методы **не изменены**
  диффом, только читаются в новой ветке рендера мебели (`_renderDecorLayer`,
  `_renderFurniturePlacementPreview`). Ни pan/zoom, ни backdrop, ни kiosk-логика в них не
  затронуты, поэтому прогон всех 29 избыточен для этой задачи — совпадение по имени
  объясняется тем, что это стандартный способ узнать текущий camera viewport, используемый
  по всему рендеру плана, а не признак задетой смежной функциональности.
- `demo/smoke_furniture.mjs` — прогнан (раздел «Как проверялось», п.5) как единственный
  смок, названный в AC1/AC3/AC4/AC6, и как единственный, где действительно меняется
  тестируемое поведение.
- `smoke_canvas_frame.mjs` (слабая связь, ← `_baseVb`) — просмотрен: сценарий про рамку
  вида/aспект, мебели и decor-strokes не касается; не прогонялся.
- `smoke_edit_walk.mjs`, `smoke_editor_gestures.mjs`, `smoke_linked_virtual_light.mjs`
  (← `_stageEl`) — просмотрены: жесты редактора и виртуальный свет, к furniture-stroke
  отношения не имеют; не прогонялись.

## Проверено и корректно (по AC)

- **AC1 (физический zoom) и AC3 (rotate+zoom):** `furniturePlanScreenScale` — ровно формула
  ТЗ, `min(viewportW/viewBoxW, viewportH/viewBoxH)` (учитывает letterboxing `xMidYMid meet`,
  не только `_zoom`). Растровый смок подтверждает удвоение толщины при переходе zoom1→zoom2
  для designer- и primitive-артворка, включая повёрнутый на 30°.
- **AC2 (анизотропный resize):** designerH/designerV сравниваются в одном фикстурном
  предмете с намеренно вытянутым native artwork — толщина по обеим осям совпадает в пределах
  2 CSS px. Юнит-тест `furniture-stroke-contract.test.mjs` формально гарантирует, что
  `furnitureStrokePx` не видит `w`/`h`/`viewW`/`viewH` предмета вообще (принимает только
  готовый `strokeUnits` + `planScreenScale`) — анизотропии неоткуда взяться.
- **AC4 (preview/commit parity):** `furnitureScreenScale` считается один раз в
  `_renderDecorLayer` и передаётся как параметр в `_renderFurniturePlacementPreview` — один
  источник числа на оба render-пути (проверено чтением: houseplan-card.ts:8095-8098,
  8171); source-contract тест запрещает preview использовать `decorCmToUnits` напрямую в
  обход `furnitureStrokePx`. Смок `previewAndCommitShareThePhysicalStroke: true`.
- **AC5 (совместимость):** полный `furniture.test.mjs` зелёный (включая перебор всех
  56 symbols на «one finite path»); erase-hit и `data-hp`/`data-kind`/`data-symbol` не
  затронуты диффом — второй тест в `furniture-stroke-contract.test.mjs` проверяет, что
  `non-scaling-stroke` на erase-hit остался. Смок целиком (палитра, drag, resize, rotate,
  wall magnet, erase) зелёный.
- **AC6 (layout safety):** `furniturePlanScreenScale`/`furnitureStrokePx` покрыты юнит-
  тестами на нулевые/`NaN`/`Infinity` входы — всегда возвращают конечное число; смок
  `viewportResizeRecalculatesTheSharedPhysicalStroke` проверяет пересчёт после ресайза
  viewport.
- **AC7 (поддерживаемые поверхности), кроме golden — см. находку выше:** код рендера
  общий для View/kiosk/Background editor (`_renderDecorLayer` не ветвится по `_mode`, кроме
  `editing`/`erasing` UI-флагов, не влияющих на арифметику толщины); light/dark не входят в
  расчёт (только `style.color`) — проверено чтением. Один нетипичный случай, разобранный
  отдельно ниже.
- **AC8 (perf/bundle):** typecheck/test/build/bundle:sync/bundle:budget зелёные (раздел
  «Как проверялось», п.3); `furnitureScreenScale` — один вызов на слой, не на предмет
  (тест это же гарантирует мутационно).
- **AC9 (документация):** `docs/FURNITURE.md` больше не утверждает, что
  `non-scaling-stroke` держит именно физическую толщину — переформулировано на «rejects only
  that local width/depth distortion... renderer separately applies the outer plan viewBox
  scale». Оба changelog обновлены в этом же коммите с ссылкой на #361 (проверено —
  `User-Visible: yes` трейлер, дифф `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` внутри
  `origin/dev...HEAD` для единственного коммита). `docs/USER-GUIDE.ru.md` — добавлено ровно
  одно предложение, терминология («физическая толщина», «приближении/отдалении плана»)
  согласована с остальным разделом, не изобретена.

## Один разобранный нетиповой случай (не находка, риск явно вне калибровки по ТЗ)

В изометрическом режиме без структуры (`_baseVb()` → `!showBorders` ветка, «no-borders»
сцена) фактический `viewBox` слоя декора берётся из `floorView` (houseplan-card.ts:11087-11090:
`isoLayers?.structural ? view : floorView`), а `furnitureScreenScale` в `_renderDecorLayer`
считается от непроецированного `planView = this._viewOr(this._baseVb())`
(houseplan-card.ts:8095), то есть не от `floorView`. `_floorView` при `_renderProjection
!== 'iso'` возвращает `view` без изменений (проверено чтением, houseplan-card.ts:5660-5665),
поэтому расхождение существует только в этой конкретной iso-ветке. Оба входа
`furniturePlanScreenScale` там всё равно конечны и положительны (клиентские размеры DOM и
размеры сцены не бывают `NaN`/`Infinity`), так что итоговая толщина остаётся конечным
числом — `NaN`/пропажа мебели невозможны. Именно это и есть весь обязательный минимум для
iso по ТЗ («его текущая геометрия не должна падать или терять мебель, но отдельная
визуальная калибровка изометрического stroke не входит в #361»); численная точность
калибровки в этой ветке ТЗ прямо не гарантирует. Не заводится ни находкой, ни отдельным
issue — разобрано и оставлено как явно принятый остаточный риск.

## Чего не проверял

- Полный `npm run golden:verify` (182 сценария) целиком — прогнаны только сценарии с
  мебелью в decor-слое плюс контрольные без неё (см. находку и её обоснование); остальные
  180 сценариев не имеют мебели и не могут пострадать от этого diff — не тратил на них время.
- Полная browser-smoke матрица (200 файлов) — вне скоупа диффа; прогнан только целевой
  `smoke_furniture.mjs` и разобраны все связи, названные `smoke-select.mjs` (раздел выше).
- `npm run invariants` — diff не геометрический (обоснование в п.7 «Как проверялось»).
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py` (п.8).
- Performance-профили/бенчмарки — не названы в AC, риск перфа закрыт чтением кода
  (одноразовый расчёт на слой) и существующим `npm run bundle:budget`.
- Ручное тестирование в браузере человеком — не проводилось, весь цикл проверен автоматикой
  и чтением кода, как предписано процессом для код-ревью.

## Вывод

Единственная находка — Medium, в скоупе задачи, не про корректность кода, а про
незавершённый релизный артефакт (golden baselines), явно предписанный собственным ТЗ этой
задачи. Верните на доработку: прогнать полный CI Validate на ветке, принять новые
golden-бейзлайны для 4 названных сценариев через `npm run golden:accept -- --reviewed`
из этого CI-прогона и закоммитить обновлённые PNG вместе с остальным изменением.
