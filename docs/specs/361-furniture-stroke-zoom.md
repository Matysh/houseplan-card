# #361 — Физическая толщина линий мебели при camera zoom

Issue: [#361](https://github.com/Matysh/houseplan-card/issues/361)

## Сценарий

Персона **администратор дома** (J4/J6 из `docs/SCOPE.md`) размещает или уже
настроил мебель в **Редакторе подложки**, а затем приближает план либо смотрит
его в обычном View. Толщина контура задана в физических единицах и должна
вести себя как остальные физические линии декора.

View и kiosk остаются release-blocking на desktop и touch. Само редактирование
на touch остаётся best effort по `docs/TOUCH-SUPPORT.md`.

## Что человек увидит до и после

Сейчас при приближении плана мебель сохраняет прежнюю экранную толщину линии;
после исправления её контур увеличивается и уменьшается вместе с планом, не
искажаясь при изменении ширины и глубины предмета.

## Проблема

`DecorShape.width_cm` и session default `DecorStyle.widthCm` уже задают
физическую толщину, а `decorStrokeUnits()` корректно переводит её в единицы
плана. Обычные line/rect/ellipse рисуют этот `stroke-width` в пространстве
плана, поэтому camera zoom естественно меняет его экранный размер.

Сохранённая мебель и placement-preview дополнительно используют
`vector-effect="non-scaling-stroke"`. Он нужен для защиты линии от локального
неравномерного `scale(x, y)` native artwork, но одновременно отменяет внешний
camera zoom. В результате мебель выглядит как screen-space пиктограмма и
нарушает физический контракт декора.

Удалить `vector-effect` недостаточно: после независимого resize ширины и
глубины одинаковый штрих получит разную толщину по осям. Исправление обязано
разделить локальное масштабирование рисунка и внешний масштаб плана.

## Скоуп

- сохранённая мебель во View и Редакторе подложки;
- полупрозрачный placement-preview мебели до клика;
- единый расчёт физической экранной толщины для обоих render-путей;
- designer-art из native `viewBox` и 12 retained primitive symbols;
- независимый resize ширины/глубины, поворот и camera zoom;
- unit/source-contract проверки, browser smoke с растровым измерением и
  детерминированное визуальное доказательство;
- актуализация документации мебели, пользовательского руководства и двух
  changelog.

## Не-скоуп

- миниатюры категорий и вариантов в палитре: это screen-space UI, их
  `non-scaling-stroke` и визуальная толщина не меняются;
- изменение рисунков, состава или размеров по умолчанию библиотеки;
- изменение сохранённого `width_cm`, `w`, `h`, `x`, `y`, `angle` или `symbol`;
- изменение выбора, hit-area, erase-hit, drag, resize, rotate, wall magnet и
  placement resolver;
- изменение толщины line/rect/ellipse/text либо других элементов плана;
- новая настройка, новый UI, миграция config или backend;
- публичное изменение скрытого изометрического режима. Его текущая геометрия
  не должна падать или терять мебель, но отдельная визуальная калибровка
  изометрического stroke не входит в #361.

## Контракт поведения

1. `width_cm` остаётся единственным каноническим источником толщины контура
   мебели. Для нового preview источником до записи служит текущий
   `DecorStyle.widthCm`.
2. При неизменных `width_cm`, размерах предмета и viewport изменение camera
   zoom с `z1` на `z2` меняет видимую толщину контура в отношении `z2 / z1`, с
   тем же raster tolerance, что у контрольной decor-line.
3. На одном zoom мебель и обычная decor-line с одинаковым `width_cm` имеют
   одинаковую видимую толщину независимо от размера карточки и fit-view.
4. Неравномерный resize предмета не меняет толщину его линии: горизонтальные,
   вертикальные и диагональные штрихи одного symbol остаются визуально
   одинаковыми в пределах raster tolerance.
5. Поворот предмета не меняет толщину. Комбинация rotate + anisotropic resize
   + camera zoom выполняет пункты 2–4 одновременно.
6. Placement-preview и сохранённый после клика предмет используют один и тот
   же stroke resolver. При одинаковом symbol, box, angle и style их геометрия
   и видимая толщина совпадают; различается только штатная общая прозрачность
   preview `0.55`.
7. Входы с нулевым/неизмеренным viewport, невалидным zoom или невалидной
   толщиной никогда не создают `NaN`, `Infinity` или исчезающий path. До
   получения валидного layout используется безопасный конечный fallback, а
   первый открытый пользователю кадр после boot veil уже пересчитан по
   фактическому viewport.
8. Неизвестный `symbol` остаётся валидными данными и безопасным no-op. Никакой
   новый runtime SVG/path из config не принимается.

## Технический render-контракт

- Локальный transform native artwork продолжает отвечать только за коробку
  предмета. Он не может анизотропно менять stroke.
- Внешний plan CTM/viewBox отвечает за camera zoom. Физический stroke обязан
  учитывать именно его равномерный user-unit-to-screen scale.
- Канонический pure helper принимает физический stroke в render units и
  измеримый plan viewport/viewBox и возвращает конечную толщину для
  non-scaling furniture path. Saved и preview не повторяют формулу отдельно.
- Для `preserveAspectRatio="xMidYMid meet"` учитывается фактический uniform
  scale `min(viewportWidth / viewBoxWidth, viewportHeight / viewBoxHeight)`, а
  не только `_zoom`: это сохраняет паритет с обычным decor при разных размерах
  карточки и letterboxing.
- Допустима эквивалентная реализация с заранее преобразованной геометрией,
  только если она доказывает те же AC и не парсит/пересобирает все SVG path на
  каждом render. Предпочтительный малорисковый путь — сохранить компактный
  artwork и локальный `non-scaling-stroke`, компенсировав только внешний plan
  scale.
- Erase-hit остаётся screen-oriented технической hit-area и не становится
  пользовательской физической линией. Его текущая интерактивная ширина не
  должна сузиться или начать зависеть от `width_cm`.
- `data-hp="decor"`, `data-kind="furniture"`, `data-id`, `data-symbol`, class
  names и один основной `<path>` на объект остаются стабильными.

## UX и доступность

Новых контролов, подписей, состояний focus/hover и действий нет. Исправление
видно только как корректная толщина уже существующего контура. Preview остаётся
`aria-hidden="true"` и `pointer-events="none"`; palette thumbnails и их
доступные имена не меняются.

## Модель данных, миграция и совместимость

Persisted schema не меняется:

```ts
{ kind: "furniture", symbol, x, y, w, h, color, opacity, width_cm, angle? }
```

- schema/config version и backend validation не меняются;
- сохранение или открытие старого плана не переписывает furniture records;
- прежние физические значения `width_cm` начинают отображаться правильно без
  migration;
- unknown symbol, card-mod hooks и forward compatibility #159 сохраняются;
- поведение palette preview остаётся screen-fixed и не наследует новый
  physical-plan resolver.

## i18n

Новых или изменённых UI-строк нет. Файлы `src/i18n/*.json` не меняются.

## Производительность и bundle

- сложность render остаётся O(число предметов), без DOM-узлов сверх прежнего
  одного основного path и условного erase-hit;
- запрещено DOM-измерение на каждый предмет и повторный parse больших designer
  path на каждый Lit render;
- один viewport scale вычисляется один раз на кадр/слой и переиспользуется для
  saved furniture и preview;
- новых runtime dependencies нет;
- `npm run bundle:budget` проходит без изменения budget; заметный initial gzip
  рост требует упрощения реализации, а не поднятия лимита в #361.

## Touch и темы

- View/kiosk на touch получают тот же физический zoom-контракт, что desktop;
- touch placement не получает hover-preview и не меняет действующий безопасный
  tap/cancel flow;
- светлая и тёмная темы не меняют арифметику толщины, цвет/opacity остаются
  текущими;
- Background editor остаётся desktop-first; новый touch UX не вводится.

## Затронутые файлы и модули

- `src/houseplan-card.ts` — saved furniture и placement-preview render;
- `src/furniture.ts` либо узкий pure helper рядом с decor geometry — единый
  расчёт внешнего plan scale/stroke;
- `test/furniture.test.mjs` — арифметика, finite fallback, designer/primitive и
  anisotropic invariants;
- узкий source-contract/mutation test — saved/preview используют общий helper,
  физический path не возвращается к безусловному screen-fixed stroke;
- `demo/smoke_furniture.mjs` — raster zoom, resize/rotate и preview/commit;
- `demo/golden/matrix.mjs` и Linux golden artifact — только если существующая
  сцена не даёт ревьюеру достаточного визуального доказательства двух zoom;
- `docs/FURNITURE.md`, релевантный абзац `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## Критерии приёмки

- **AC1 — физический zoom:** для сохранённого designer symbol и retained
  primitive symbol raster-smoke на двух camera zoom доказывает пропорциональное
  изменение экранной толщины и паритет с decor-line того же `width_cm`.
  **Доказательство:** browser smoke с pixel measurement; unit-тест формулы.
- **AC2 — независимый resize:** после выраженно неравномерного resize
  горизонтальные, вертикальные и диагональные штрихи имеют одинаковую толщину
  в пределах `max(1 CSS px, 10%)`; их box действительно изменён по двум осям.
  **Доказательство:** raster browser smoke и unit-тест transform inputs.
- **AC3 — rotate + zoom:** повёрнутый anisotropic designer symbol сохраняет
  равномерный stroke, а переход между двумя zoom даёт ожидаемое отношение.
  **Доказательство:** raster browser smoke.
- **AC4 — preview/commit parity:** preview до клика и сохранённый path после
  клика совпадают по symbol/box/angle/stroke resolver; preview отличается
  только штатной прозрачностью и оба состояния масштабируют линию одинаково.
  **Доказательство:** `demo/smoke_furniture.mjs` и source-contract test.
- **AC5 — совместимость:** все 56 symbols, unknown no-op, один основной path,
  card-mod hooks, selection/drag/resize/rotate/erase и wall magnet не
  регрессируют; palette thumbnails остаются screen-fixed.
  **Доказательство:** `test/furniture.test.mjs`, существующий furniture smoke,
  ревью кода.
- **AC6 — layout safety:** нулевые и невалидные измерения дают конечный
  fallback без `NaN`/исчезновения, а layout update пересчитывает толщину по
  фактическому viewport.
  **Доказательство:** unit-тесты и browser smoke с resize карточки.
- **AC7 — поддерживаемые поверхности:** flat View, kiosk и Background editor
  используют один контракт; light/dark не меняют толщину, touch View не падает.
  **Доказательство:** browser smoke и релевантная golden/screenshot matrix.
- **AC8 — производительность и сборка:** нет per-item DOM measurement,
  per-render path parser и новых dependencies; typecheck, unit, build,
  bundle sync и budget зелёные.
  **Доказательство:** ревью кода, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run bundle:sync`, `npm run bundle:budget`.
- **AC9 — документация и релиз:** канон больше не утверждает, что безусловный
  `non-scaling-stroke` является физическим; RU/EN changelog описывают видимое
  исправление со ссылкой на #361.
  **Доказательство:** docs/process gates и ревью кода.

## План автотестов

1. Добавить pure unit matrix для plan screen scale: разные zoom/viewBox,
   portrait/landscape viewport, letterboxing, zero/NaN fallback.
2. Проверить одинаковый resolver для designer и retained artwork, saved и
   preview; mutation guard должен падать при возврате безусловно screen-fixed
   физического stroke либо при удалении camera-scale compensation.
3. Расширить `demo/smoke_furniture.mjs` контролируемой сценой: рядом находятся
   decor-line, designer furniture и retained primitive с одинаковым
   `width_cm`; screenshot декодируется и толщина измеряется по пикселям на
   zoom 1 и zoom 2.
4. В той же сцене неравномерно изменить box, повернуть предмет и повторить
   raster measurement по горизонтальному, вертикальному и диагональному
   штрихам.
5. Вооружить placement-preview, измерить его до клика, кликнуть и доказать
   совпадение saved path после commit; затем resize viewport и повторить scale
   assertion.
6. Оставить palette thumbnail control: его толщина между zoom плана не
   меняется.
7. В цикле реализации запускать `npm run typecheck`, `npm test`,
   `npm run build`; перед переводом в `S7-code-review` дополнительно запустить
   названный в AC целевой `node demo/smoke_furniture.mjs`. Golden, полный набор
   browser smoke, performance и полный gate запускаются в предрелизном
   прогоне; тестовые сценарии и assertions входят в продуктовый коммит заранее.

## Риски

- **Компенсирован не тот transform.** `_zoom` без viewport/letterboxing даёт
  совпадение только на одном размере карточки. Снижается матрицей viewBox ×
  viewport и сравнением с decor-line.
- **Наивное удаление vector-effect.** Создаёт анизотропную линию после resize.
  Снижается raster AC2 и mutation guard.
- **Preview расходится с saved path.** Снижается одним helper и AC4.
- **Первый layout не измерен.** Снижается finite fallback, boot veil и smoke с
  resize observer/layout update.
- **Дорогая подготовка SVG.** Снижается запретом per-render parsing и bundle /
  code review gate.
- **Случайно меняются thumbnails или erase-hit.** Они явно отделены контрактом
  и имеют контрольные assertions.

## Откат

Вернуть прежний furniture stroke resolver/render attributes и удалить новые
тестовые assertions. Persisted schema и пользовательские records не меняются,
поэтому обратной миграции и очистки данных нет. Откат вернёт только известный
визуальный дефект screen-fixed толщины.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: пользовательское исправление со
  ссылкой на #361;
- `docs/FURNITURE.md`: точное разделение local artwork scale и physical plan
  zoom;
- `docs/USER-GUIDE.ru.md`: коротко зафиксировать, что физическая толщина мебели
  масштабируется вместе с планом;
- целевой browser artifact из `demo/smoke_furniture.mjs` с двумя zoom и
  anisotropic resize;
- если меняется или добавляется golden-сцена, baseline принимается только из
  полного Linux CI artifact через `npm run golden:accept -- --reviewed`;
- backend, migration, security и новые performance artifacts не требуются;
  общий bundle budget остаётся обязательным.

## Принято предположительно, поменять свободно

- имя и размещение pure helper;
- способ передачи viewport/viewBox scale в decor renderer;
- точные тестовые symbols и цвета контролируемой raster-сцены;
- реализация pixel measurement без новой runtime dependency;
- добавлять отдельный golden-сценарий только если raster smoke не даёт
  ревьюеру однозначного визуального доказательства.
