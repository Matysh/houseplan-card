# #193 — превью размещения открытого проёма

- Issue: [#193](https://github.com/Matysh/houseplan-card/issues/193)
- Связано: [#157](https://github.com/Matysh/houseplan-card/issues/157)
- Приоритет: P2
- Ветка: `issue/193-passage-preview`
- Статус документа: первая редакция, готова к ревью ТЗ
- Основание: описание владельца и аналитика от 2026-08-19

## 1. Пользовательский сценарий

Персона — home admin. В desktop Plan editor он выбирает инструмент «Открытый
проём» и ведёт указателем вдоль стены, чтобы до клика выбрать место будущего
прохода.

Сейчас администратор видит точку привязки и размерные линейки, но не видит длину
участка стены, который исчезнет. Дверь, окно и ворота показывают свой символ, а
единственный визуальный результат passage появляется только после клика.

## 2. Что человек увидит

До изменения инструмент показывает только точку и размеры; после изменения
поверх стены заранее виден полупрозрачный участок будущего разрыва с двумя
засечками его границ.

## 3. Проблема и ожидаемый результат

`_renderOpeningPlacementPreview()` уже строит единый preview по разрешённому
placement-candidate. Для `passage` общий `renderOpeningVisibleGeometry()`
намеренно возвращает пустой SVG, потому что сохранённый открытый проём является
отрицательным пространством и не имеет архитектурного символа. Правильное
решение #157 в слое постоянного рендера делает placement-инструмент слепым.

После #193 только при размещении нового `passage` поверх стены рисуется временная
editor-геометрия:

1. прямоугольный полупрозрачный сегмент на месте будущего wall cut;
2. две поперечные засечки на концах сегмента;
3. существующие точка привязки и линейки без изменений.

После клика временная геометрия исчезает. Сохранённый passage по-прежнему виден
только как реальный разрыв кладки и пол внутри него.

## 4. Подтверждённая техническая база

- `_openingPreview` и `_openingClick()` используют один
  `OpeningPlacementCandidate`; hover не требует повторного snap.
- Candidate содержит `x`, `y`, `angle`, `renderedLength` и
  `target.physicalHalfWidth`.
- `physicalHalfWidth` вычисляется `openingPlacementTargets()` из тех же
  `wallIntervals` и partition intervals, которыми определяется выбранное
  физическое тело стены. Для совпадающих room-owned копий берётся максимальная
  реальная половина толщины.
- Сохранение записывает длину из того же candidate; после сохранения masonry
  строит passage cut из канонической opening geometry.
- Placement preview уже находится после wall bodies в SVG-порядке, поэтому
  новая геометрия будет видна поверх кладки без нового слоя.
- `.opening-preview` и `.opening-preview-dot` уже имеют `pointer-events: none`,
  а группа помечена `aria-hidden="true"`.
- `_opMeasureView` уже отдаёт `candidate.measure`, поэтому линейки не требуют
  изменений.
- Drag существующего opening — отдельный pipeline. Он live-обновляет сохранённую
  opening geometry и masonry cut; placement-preview там не используется.
- Golden-матрица содержит door placement-preview на толстой стене, но harness
  сейчас валидирует только типы с `.op-leaf` и не принимает `passage`.

## 5. Scope

### 5.1 Геометрия placement-preview

Для `candidate.type === 'passage'` вместо общего архитектурного символа строится
специальная preview-геометрия в уже существующей transform-группе:

- локальный центр: `(0, 0)`;
- ширина прямоугольника: ровно `candidate.renderedLength`;
- высота: ровно `candidate.target.physicalHalfWidth * 2`;
- локальный `x`: `-candidate.renderedLength / 2`;
- локальный `y`: `-candidate.target.physicalHalfWidth`;
- поворот и перенос: существующий group transform из `candidate.angle/x/y`;
- засечки расположены при `x = ±candidate.renderedLength / 2` и идут
  перпендикулярно стене;
- каждая засечка проходит через всю фактическую толщину и выступает за обе
  границы стены на `gridPitch * 0.18`.

Числа не вычисляются повторно из preset или сохранённого конфига. Разрешён
маленький чистый helper метрик в `opening-placement.ts`, если он одновременно
используется рендером и unit-тестом.

### 5.2 Визуальный контракт

- сегмент использует текущий `--wall-fill` с fallback текущего wall renderer;
- эффективная opacity сегмента — `0.35`;
- засечки используют `var(--hp-open, #ff9800)` и толщину `2.5` render units,
  совпадающую с существующими jamb marks opening renderer;
- passage preview не наследует общую opacity `0.5` второй раз: итоговая
  прозрачность сегмента должна остаться `0.35`, а не `0.175`;
- геометрия не анимируется;
- точка, линейки, cursor и toolbar state не меняются;
- light/dark theme получают свои существующие wall/open CSS variables без
  отдельной палитры и без новых пользовательских настроек.

### 5.3 Проверки и документация

- unit-тест точных локальных метрик для обычной и нестандартной толщины стены;
- source/negative contract, что passage-ветка изолирована от других типов;
- обновление `demo/smoke_opening_preview.mjs`;
- type-aware поддержка passage в golden harness;
- отдельные passage placement golden-сценарии на толстой стене в dark и light;
- обновление `docs/TESTING.md`, RU/EN user guide и обоих changelog.

## 6. Non-scope

- постоянный символ, рамка, створка, дуга или засечки у сохранённого passage;
- изменение фактической masonry/tunnel/light geometry #157;
- изменение placement, snap, center magnet, ruler labels или default 90 см;
- drag-overlay для существующего passage: во время drag реальный wall cut уже
  перемещается live;
- изменение preview двери, окна или ворот;
- новые настройки цвета, opacity или размера засечек;
- backend, schema, config, migration, import/export и compatibility fields;
- новый i18n-текст;
- публичность скрытой изометрии;
- расширение touch-гарантий Plan editor.

**Touch editor:** best effort / intentionally degraded. Preview наследует
существующий статус Plan editor: это presentation-only hover-эффект, который не
расширяет touch-гарантии.

## 7. Контракт поведения

### 7.1 Появление

Preview существует только когда одновременно выполнены условия:

- активен существующий opening placement tool;
- выбран preset `passage`;
- `_openingPreview` разрешил валидный candidate на физической стене или
  partition;
- указатель не находится над существующим opening и не открыт properties dialog.

Вне валидной стены preview отсутствует по нынешнему fail-closed поведению.

### 7.2 Hover и клик

Один resolved candidate является authority для preview и следующего клика.
Отрисованный центр, угол и длина не могут расходиться с данными, которые затем
попадут в properties dialog. После клика `_openingHoverCandidate` и `_cursorPt`
очищаются существующим кодом, поэтому cut-preview, засечки, точка и линейки
исчезают вместе.

### 7.3 После сохранения

Preview-only классы не появляются внутри `.opening[data-kind="passage"]`.
`renderOpeningVisibleGeometry({type:'passage'})` продолжает возвращать пустой
результат. Пользователь видит канонический wall cut, а не продублированный
полупрозрачный прямоугольник.

### 7.4 Остальные типы

`window`, `door` и `gate` продолжают вызывать только
`renderOpeningVisibleGeometry(visibleSpec)`. Их DOM signature, opacity,
геометрия и existing golden остаются неизменными; passage-классы в их preview
отсутствуют.

### 7.5 События и доступность

Группа остаётся `aria-hidden="true"` и `pointer-events="none"`; preview не
получает role/tabindex/handlers. Дочерние rect/line также явно не становятся
hit-test targets. Существующий click, hover, pan и ruler pipeline не меняется.

## 8. UX-состояния

| Состояние | Результат |
|---|---|
| Passage над валидной room wall | сегмент реальной длины и толщины, две засечки, точка, линейки |
| Passage над валидной partition | тот же контракт с толщиной выбранной partition |
| Passage вне стены / над open span / над column | preview отсутствует по текущим правилам |
| Passage над существующим opening | preview отсутствует, клик редактирует существующий объект |
| Properties dialog открыт | preview отсутствует |
| Сохранённый passage в Plan/View/Static/iso | никакого нового символа; только существующий физический разрыв |
| Door/window/gate placement | прежний preview без passage-сегмента и passage-засечек |

## 9. Модель данных и миграция

Модель данных не меняется. Новых ключей конфига, runtime-state, local storage,
backend schema и migration step нет. Preview вычисляется только для текущего
кадра из уже существующего transient candidate.

## 10. i18n

Новых строк нет. Название `passage`, подсказки инструмента и ruler formatting
остаются из #157 и общего opening pipeline. RU/EN JSON не меняются.

## 11. Критерии приёмки

### AC1 — точная геометрия passage preview

При валидном passage-candidate preview содержит один cut-сегмент и ровно две
boundary-засечки. Ширина сегмента равна `renderedLength`, высота равна
`2 * target.physicalHalfWidth`, центр и угол равны candidate; засечки стоят на
обоих концах и выступают на `gridPitch * 0.18` с каждой стороны.

**Доказательство:** unit точных чисел минимум для двух wall thickness + browser
smoke по SVG attributes + dark/light golden ручного вида.

### AC2 — preview и сохранение используют один candidate

Клик после hover открывает dialog с теми же `x/y/angle/length`, которые были у
отрисованного preview. После сохранения длина канонической записи соответствует
этому candidate, а preview-only rect/lines отсутствуют в committed opening.

**Доказательство:** `smoke_opening_preview.mjs`, продолжающий существующую
проверку `saveMatchesResolver` и добавляющий signature passage-preview до/после.

### AC3 — сохранённый passage не получает символ

Общий renderer passage по-прежнему не выдаёт jamb/leaf/arc/glass/frame и не
выдаёт новые preview-only элементы. Plan/View/Static/iso semantics #157 не
изменяются.

**Доказательство:** существующий `opening-symbol.test.mjs` + расширенный
source contract + smoke committed DOM.

### AC4 — другие типы не меняются

Door, window и gate preview не проходят через passage-геометрию, сохраняют свои
existing visible signatures и не содержат passage preview classes.

**Доказательство:** negative unit/source contract + существующие и расширенные
smoke assertions + неизменный door golden.

### AC5 — overlay не меняет взаимодействие и линейки

Passage preview, его rect/lines и точка не участвуют в hit-test и accessibility
tree. `_opMeasureView` продолжает показывать обе ruler labels и center guide по
тем же данным; pointer click проходит в существующий placement handler.

**Доказательство:** source/unit contract атрибутов + browser smoke двух ruler
labels, `pointer-events: none`, `aria-hidden`, успешного click/save.

### AC6 — визуальная тема и фактическая толщина

В dark и light segment берёт theme wall fill и сохраняет эффективную opacity
`0.35`; засечки используют `--hp-open`. На нестандартной толстой стене segment
совпадает с физической шириной тела, а засечки видны за обоими краями.

**Доказательство:** computed-style smoke + две type-aware golden-сцены на одной
толстой wall fixture; semantic pixel guard обязан доказать changed pixels внутри
фактического `.wallbody-fill`, а не только рядом со стеной.

## 12. План автотестов

### Unit/source

1. Чистые preview-метрики возвращают точные rect/ticks для standard wall.
2. Изменение `physicalHalfWidth` меняет только высоту rect и длину ticks, но не
   ширину и x-концы.
3. Renderer выбирает passage-ветку только при `candidate.type === 'passage'`.
4. `renderOpeningVisibleGeometry(passage)` остаётся пустым.
5. Все preview-only элементы остаются внутри non-interactive aria-hidden group.

Тесты должны быть falsifiable: на `origin/dev` до реализации как минимум unit
геометрии и smoke DOM обязаны краснеть из-за отсутствующей preview-геометрии.

### Smoke

`demo/smoke_opening_preview.mjs` проверяет:

- наличие rect + двух ticks у passage hover;
- SVG metrics против resolved candidate;
- computed fill/opacity/stroke variables;
- сохранение dot и ruler labels;
- отсутствие passage preview classes у window/door/gate;
- исчезновение preview при dialog/save/leaving tool;
- отсутствие preview-only symbol у committed passage.

### Golden

- расширить allowlist `openingPreview.type` литералом `passage`;
- type-specific semantic selector: `.op-leaf` для прежних типов,
  `.passage-preview-cut` + две `.passage-preview-boundary` для passage;
- добавить `opening-placement-passage-thick-wall-dark` и
  `opening-placement-passage-thick-wall-light` на `golden-geometry`;
- обе сцены используют semantic `openingPreviewPixels`: preview обязан менять
  достаточное число пикселей и красить пиксели внутри реальной wall fill;
- существующий door scenario и его baseline не меняются;
- baseline acceptance не входит в implementation loop и выполняется только по
  release-процессу после Linux review artifact.

### Реализационные гейты

В цикле реализации: `npm run typecheck`, `npm test`, `npm run build`.
Перед `S7-code-review`: затронутый smoke и целевые golden capture/verify по
актуальному процессу. Полный golden/smoke/performance остаётся pre-beta gate.

## 13. Риски и меры

| Риск | Мера |
|---|---|
| Preview длиной отличается от будущего cut | использовать только `candidate.renderedLength`, не preset/dialog |
| Нестандартная partition/wall толщина игнорируется | использовать только `target.physicalHalfWidth` |
| Opacity применяется дважды | отдельная passage group/style с проверкой computed effective value |
| Геометрия оказывается под стеной | сохранить текущую позицию preview layer после wall bodies + semantic inside-wall pixels |
| Passage случайно получает постоянный символ | preview-only branch остаётся у caller, общий renderer passage остаётся пустым |
| Door/window/gate меняют DOM | явная type branch и negative contracts |
| Golden существует, но не доказывает содержимое | type-specific selector и changed-inside-wall semantic assertion |
| Preview начинает ловить pointer | group и children non-interactive, smoke click/save |

Производительность: максимум три простых SVG-элемента только во время валидного
hover. Новых geometry passes, observers, subscriptions, cache keys и animation
нет; отдельный performance profile не требуется.

## 14. Откат

Откат удаляет passage-only preview branch/helper/styles, новые assertions и
golden-сценарии. Модель данных и сохранённые планы не затронуты; после отката
возвращается прежний слепой preview с точкой и линейками, а #157 продолжает
работать без migration/downgrade действий.

## 15. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в user-visible implementation
  commit;
- RU/EN user guide: размещение passage заранее показывает ширину будущего
  разрыва;
- `docs/TESTING.md`: unit/smoke/golden proof;
- синхронные `dist`, integration frontend и demo bundle;
- golden candidates только для двух новых passage preview scenarios; baseline
  acceptance — позднее по release runbook;
- issue остаётся открытой до выпуска беты.

## 16. Принято предположительно, поменять свободно

Ниже технические, а не продуктовые решения; ревьюер может изменить их без
вопроса владельцу, если AC сохраняются:

1. Чистые numeric metrics можно разместить в `opening-placement.ts`, а SVG
   оставить в `_renderOpeningPlacementPreview()`.
2. Имена классов в ТЗ (`passage-preview-cut`,
   `passage-preview-boundary`) являются рекомендуемыми, не публичным API.
3. Выступ засечек `gridPitch * 0.18` выбран равным радиусу текущей preview-dot:
   он масштабируется с планом и не вводит сантиметровый config contract.
4. Для двух passage golden используется одна и та же thick-wall fixture и
   pointer, меняется только theme; точные pixel thresholds калибруются по Linux
   artifact так, чтобы тест падал при отсутствии rect или любой из засечек.
5. При невозможном/legacy target с нулевой физической толщиной rect имеет нулевую
   высоту, а две засечки всё равно показывают границы длины. Искусственная
   «толщина стены» не придумывается, потому что это нарушило бы главный контракт
   совпадения с physical metrics.
