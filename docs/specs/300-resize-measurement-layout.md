# Issue #300 — Понятные подписи и измеряемые стены во время Resize

- Дата: 2026-08-24
- Тип: feature / polish · приоритет P2
- Ценность пользователю: 7/10 · ценность разработке: 4/10
- Сложность: 5/10 · риск: 5/10
- Issue: [#300](https://github.com/Matysh/houseplan-card/issues/300)
- Ветка: `issue/300-resize-labels`

Канонические документы: `docs/SCOPE.md`, `docs/RESIZE.md`,
`docs/CANVAS.md`, `docs/USER-GUIDE.ru.md`, `docs/USER-GUIDE.md`,
`docs/ARCHITECTURE.md`, `docs/TOUCH-SUPPORT.md`.

Связанные контракты: [#233](233-resize-inner-dimensions.md) — внутренние
размеры, [#277](277-safe-resize.md) — fixed-topology Resize.

## 1. Сценарий и персона

Администратор дома на компьютере открывает **Редактор плана**, выбирает
**Resize** и тянет горизонтальную или вертикальную стену. Во время жеста он
смотрит, как меняются две соседние длины и чистая площадь одной либо двух
комнат.

Это улучшение J6 из `docs/SCOPE.md`: редактор помогает поддерживать план в
актуальном состоянии. View, киоск, редактор устройств, редактор подложки и
статическая карточка не затронуты.

## 2. Что человек увидит до и после

**До:** рядом со стенами висят три длины без визуальной связи с измеряемыми
отрезками; одна из них относится к перемещаемой стене и не меняется. Площадь
находится в середине комнаты и может оказаться под кнопкой её настроек.

**После:** видны только две меняющиеся длины, а соответствующие соседние стены
подсвечены. Площадь каждой затронутой комнаты находится со своей стороны
перемещаемой стены и связана с ней короткой выносной линией.

## 3. Подтверждённая проблема

Текущий `_rszEdgeLabels()` в `src/houseplan-card.ts`:

1. добавляет длины предыдущего, перемещаемого и следующего ребра основной
   комнаты;
2. не передаёт в render model идентичность измеряемого ребра, поэтому отдельной
   подсветки нет;
3. ставит площадь каждой изменяемой комнаты в `poleOfInaccessibility(floor)` —
   туда же, где в Plan editor находится `.rlgearbtn`.

Числа уже корректны по #233: `_rszInnerSpanCms()` измеряет между внутренними
гранями, а площадь считается по чистому полу через `innerContourForRoom()` и
`floorMinusBodies()`. Задача не меняет математическую конвенцию чисел — только
отбор, связь и расположение.

## 4. Зафиксированные продуктовые решения

1. Длина перемещаемой стены не показывается: движение параллельно самой себе не
   меняет её длину.
2. Показываются две длины соседних рёбер **основной комнаты**, которые уже
   показывались по обе стороны от перемещаемого ребра. На общей стене не
   добавляются ещё две дублирующие длины соседней комнаты.
3. Оба ребра с показанными длинами подсвечиваются всё время активного жеста.
4. Площадь располагается по нормали от середины перемещаемой стены в сторону
   соответствующей комнаты. Для общей стены одновременно видны две площади по
   разные стороны.
5. Решение владельца по Q1 от 2026-08-24: принят **не default, а альтернатива**.
   Площадь остаётся видимой всегда. Если плашка не помещается внутри узкой
   комнаты, ей разрешено выйти за границу комнаты; выносная линия продолжает
   однозначно связывать её с нужной стороной стены. Площади не перекрывают друг
   друга.
6. Кнопка настроек комнаты остаётся видимой. Если nominal area-плашка попадает
   в zoom-dependent footprint кнопки для текущего `view.w`, вычисленный по
   `iconCqw()`, плашка сдвигается вдоль перемещаемой стены до первого свободного
   положения; leader сохраняет связь с исходным midpoint.

Пункт 5 заменяет первоначальный AC6 в теле issue, где требовалось удерживать
плашку внутри комнаты: владелец явно выбрал альтернативу в комментарии.

## 5. Скоуп

### Входит

- render model двух изменяемых длин и двух соответствующих подсвеченных рёбер;
- pointer-transparent SVG-подсветка поверх кладки;
- размещение одной/двух площадей у перемещаемой стены;
- короткие выносные линии для площадей;
- collision-free раскладка area-плашки относительно room settings button;
- horizontal/vertical, outer/shared и оба направления drag;
- unit, browser smoke, golden, mutation guards и RU/EN документация.

### Не входит

- математика длины и площади #233;
- eligibility, clamp, preview, commit, Undo и opening movement #277;
- новые виды Resize, диагональные стены и изменение топологии;
- постоянные размеры в View (#52) и подписи размещения проёмов (#238);
- изменение Room card или сохранённой позиции её подписи;
- config/backend, storage, схема, миграция и compatibility-поля.

## 6. Контракт проекции подписей

Из `_rszEdgeLabels()` выделяется renderer-independent проекция (рабочее место —
новый `src/resize-labels.ts`). Вход:

- immutable `SafeResizePlan`;
- candidate `res.polys` после `clampSafeResize()`;
- два уже вычисленных текста внутренних длин основной комнаты;
- тексты площадей комнат из `plan.roomIds`;
- текущий SVG viewBox.

Выход не содержит Lit/DOM и различает три сущности:

```ts
type ResizeLengthLabel = {
  kind: 'length'; roomId: string; edge: number;
  x: number; y: number; text: string;
};

type ResizeMeasuredEdge = {
  roomId: string; edge: number; a: Pt; b: Pt;
};

type ResizeAreaLabel = {
  kind: 'area'; roomId: string; x: number; y: number; text: string;
  side: 'left' | 'right' | 'above' | 'below';
  tangentOffsetPx: number;
  leader: { a: Pt; b: Pt };
};
```

Имена типов технические и могут измениться без продуктового решения.

### 6.1 Две длины

Для `plan.roomId` и `plan.edge = i` возвращаются только рёбра:

- `(i - 1 + n) % n`;
- `(i + 1) % n`.

Само ребро `i` отсутствует и в label model, и в DOM. Текст продолжает брать
число из `_rszInnerSpanCms()` и форматировать через существующий
`formatLength()`. Позиция остаётся в середине соответствующего ребра candidate,
чтобы не менять привычную связь подписи со стеной.

### 6.2 Подсветка измеряемых стен

Каждая из двух длин имеет ровно один `ResizeMeasuredEdge` с теми же room/edge и
candidate endpoints. Подсветка:

- повторяет сохранённую ось стены от endpoint до endpoint; это идентификатор
  стены, а не новая размерная линия;
- рисуется сплошным accent-штрихом с theme-aware halo;
- имеет `vector-effect="non-scaling-stroke"`, одинаково читается при zoom и
  `cell_cm` 1/5 см;
- находится после физических wall bodies, но до символов проёмов и Resize
  handles;
- `pointer-events:none`, `aria-hidden=true`, без анимации.

Подсветка появляется только после фактического ненулевого preview move и
исчезает синхронно с `_rszLive` на pointerup, Esc, pointercancel,
lostpointercapture, pinch, смене инструмента/пространства/режима.

### 6.3 Площадь по сторонам стены

Для каждого `roomId` из `plan.roomIds` берётся его moving edge из
`plan.edgeByRoom[roomId]` и candidate poly. Внутренняя сторона определяется по
самому candidate polygon, а не по направлению записи endpoint:

- вертикальная стена даёт `left` или `right`;
- горизонтальная — `above` или `below`.

HTML-плашка якорится на midpoint moving edge. CSS-смещение использует **полный
собственный размер плашки**, поэтому не требует синхронного DOM measurement:

- `left`: плашка заканчивается за 12 CSS px до midpoint;
- `right`: начинается через 12 CSS px после midpoint;
- `above`: нижняя грань за 12 CSS px до midpoint;
- `below`: верхняя грань через 12 CSS px после midpoint.

Таким образом две плашки общей стены занимают противоположные полуплоскости и
не могут перекрыться независимо от длины локализованного текста. На наружной
стене строится одна плашка на стороне комнаты.

Для collision check используется консервативный screen-space footprint
плашки, вычисленный из форматированного текста и font/padding tokens, а также
zoom-dependent footprint `.rlgearbtn`, вычисленный для текущего `view.w` по той
же `iconCqw()`-семантике, что использует CSS кнопки. Nominal position сначала
проверяется против gear той же комнаты. При пересечении helper выбирает
минимальный сдвиг по касательной к moving wall; при равных вариантах стабильный
порядок — к меньшей screen-coordinate. Выход за room polygon разрешён решением
владельца, поэтому такой сдвиг не скрывает число и не требует менять сторону
стены.
Production gesture path не вызывает `getBoundingClientRect()` и не читает
layout; фактические DOM rectangles проверяются браузерным smoke как post-render
доказательство консервативности footprint.

Короткая выносная линия идёт от midpoint стены на 12 CSS px в сторону плашки.
Перевод screen px в render units использует текущий viewBox/stage size; stroke
остаётся screen-fixed. Линия присутствует у каждой area-плашки: в обычной
комнате это стабильная визуальная связь, а в узкой сохраняет принадлежность,
когда дальний край плашки выходит за room polygon. Плашку не прячут, не
обрезают, не переносят на противоположную сторону и не уменьшают.

## 7. Слои, жизненный цикл и безопасность жеста

Новый SVG measurement layer рисуется в существующем Plan SVG. HTML labels
остаются в `.measurelayer`. Оба слоя получают данные из одного projection
object на том же accepted preview, поэтому линия, подсветка и число не могут
относиться к разным candidate frames.

Room settings buttons продолжают рендериться и не получают нового состояния.
Area projection использует тот же вычисленный visual centre, что
`_renderRoomGear()`, поэтому collision avoidance не создаёт вторую модель
позиции кнопки.

Новые элементы pointer-inert и не меняют capture/hit priority. Существующие
гарантии `docs/RESIZE.md` обязательны без изменений:

- preview строится из immutable snapshot;
- config не меняется до pointerup;
- cancel/pinch/pointercancel/lost capture дают ноль Undo и ноль writes;
- commit сохраняет ровно существующий fixed-topology candidate.

## 8. UX и доступность

- Новых кнопок, полей, сообщений и tooltip нет.
- Цвет подсветки — существующий `--hp-accent`; halo использует фон темы.
- Area-плашка сохраняет существующий `formatArea()` и оформление `.rszarea`.
- Measurement overlay transient, non-focusable и `aria-hidden`; экранный
  диктор не получает поток значений на каждом pointermove.
- `prefers-reduced-motion` ничего не меняет: новой анимации нет.
- Light/dark темы обязаны давать одинаковую структуру и читаемый контраст.

`Touch editor: best effort / intentionally unchanged.` Resize остаётся
desktop-reference. Если существующий touch drag сработал, он получает те же
подписи; новой hover-зависимости нет. Safety floor touch сохраняется и входит в
smoke отмены.

## 9. Модель данных, миграция, i18n

**Модель данных:** не меняется. Новых config/layout полей и WebSocket calls нет.

**Миграция/compatibility:** отсутствуют. Старые планы не переписываются; обычный
Open/Save ничего не материализует.

**i18n:** новых ключей нет. Используются существующие `formatLength()` и
`formatArea()`. Переводы `src/i18n/en.json` и `src/i18n/ru.json` не должны
измениться.

## 10. Изменяемые файлы и модули

Ожидаемый набор:

- `src/resize-labels.ts` — чистая проекция двух длин, сторон площадей и leader;
- `src/houseplan-card.ts` — сбор фактических значений и render/lifecycle;
- `src/styles.ts` — measured-edge, leader и side transforms;
- `test/resize-labels.test.mjs` — pure contract;
- `test/resize-production-path.test.mjs` — production ownership/lifecycle;
- `demo/smoke_resize_labels.mjs` — outer/shared/narrow/horizontal/vertical;
- `demo/benchmark_safe_resize_render.mjs` — существующий real-render gate с
  абсолютным `RENDER_P95_MS = 25`; исходник benchmark менять не требуется;
- `demo/golden/harness.mjs`, при необходимости `demo/golden/matrix.mjs` —
  semantic checks active Resize scene;
- `scripts/mutation-gate.mjs` — guards §12;
- `docs/RESIZE.md`, `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/USER-GUIDE.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

Точный diff определяется реализацией; class A/B файлы вне этих подсистем —
находка вне скоупа.

## 11. Acceptance criteria

| AC | Требование | Доказательство |
|---|---|---|
| AC1 | После ненулевого preview move `_rszLive`/projection содержит ровно две length-подписи основной комнаты: previous и next edge; moving edge отсутствует | unit + smoke |
| AC2 | Тексты обеих длин равны текущему внутреннему контракту #233; площадь равна прежнему clean-floor значению | existing #233 smoke + smoke |
| AC3 | Ровно две подсветки повторяют candidate endpoints тех же room/edge, лежат поверх wall body и не принимают pointer events | unit + smoke + code review |
| AC4 | Наружная горизонтальная и вертикальная стена показывают одну area-плашку со стороны комнаты и одну выносную линию | unit + smoke |
| AC5 | Общая горизонтальная и вертикальная стена показывают две area-плашки с разными `roomId` по противоположным сторонам и две выносные линии | unit + smoke |
| AC6 | В narrow-room fixture обе площади остаются в DOM, могут выйти за room polygon по решению владельца, но их фактические DOM rectangles не пересекаются; leader ownership остаётся однозначным | smoke |
| AC7 | При horizontal/vertical и обоих направлениях drag room settings button остаётся видимой, а её фактический DOM rectangle не пересекает area-плашку той же комнаты | unit + smoke |
| AC8 | Pointerup очищает measurement overlay; Esc, pointercancel, lost capture и pinch также очищают его и создают 0 Undo/0 writes | smoke |
| AC9 | Light/dark active-Resize golden показывает две подсвеченные стены, две площади shared wall и читаемые leaders; принятие baseline только из полного reviewed Linux CI artifact | golden review |
| AC10 | User-visible docs и оба changelog обновлены в том же коммите; i18n/schema/backend отсутствуют в diff | code review |
| AC11 | Existing `demo/benchmark_safe_resize_render.mjs` остаётся внутри реального абсолютного потолка `RENDER_P95_MS = 25`; `_rszMove` не делает forced layout read | benchmark + code review |

## 12. Mutation guards

| id | Поломка | Краснеет |
|---|---|---|
| `resize-labels-restores-moving-length` | возвращает третью неизменяемую длину | AC1 |
| `resize-labels-drops-measured-edge` | одна длина остаётся без соответствующей подсветки | AC3 |
| `resize-labels-same-side-areas` | обе площади общей стены ставятся с одной стороны | AC5/AC6 |
| `resize-labels-hide-narrow-area` | narrow fallback скрывает одну площадь вопреки решению владельца | AC6 |
| `resize-labels-ignore-gear-collision` | nominal area-плашка не сдвигается от room settings button | AC7 |
| `resize-labels-cancel-leak` | measurement overlay переживает abort | AC8 |

## 13. План автотестов

1. `test/resize-labels.test.mjs`:
   - previous/next edge modulo polygon length;
   - moving edge отсутствует;
   - horizontal/vertical room-side projection независимо от winding и
     endpoint direction;
   - shared owners получают противоположные стороны;
   - leader переводит 12 CSS px в правильное число render units.
2. `demo/smoke_resize_labels.mjs` запускает production
   `_rszEdgeDown → _rszMove → _rszUp` реальными browser pointer events:
   - outer horizontal и vertical;
   - shared wall с двумя rooms;
   - positive/negative drag;
   - narrow room с фактической проверкой `getBoundingClientRect()` двух badges;
   - default и non-default zoom, чтобы фактический zoom-dependent rectangle
     `.rlgearbtn` оставался вне area-плашки;
   - фактическое отсутствие overlap с видимой room settings button и все abort
     paths.
3. `demo/smoke_resize_inner_dimensions.mjs` остаётся зелёным и доказывает, что
   числа #233 не изменены.
4. Existing `safe-resize-handles-clamp-light/dark` golden используется как
   визуальная сцена; harness дополнительно fail-closed проверяет semantic DOM до
   screenshot.
5. Перед `S7-code-review`: `npm run typecheck`, `npm test`, `npm run build`,
   `npm run bundle:sync`, `node scripts/check-docs.mjs`, вывод
   `node scripts/smoke-select.mjs --base origin/dev --head HEAD` и все выбранные
   target smokes, включая `node demo/benchmark_safe_resize_render.mjs` как
   доказательство абсолютного p95-бюджета 25 ms.

## 14. Производительность, security, touch

Проекция O(1) по числу затронутых комнат (максимум две) и создаёт фиксированные
две measured edges, 1–2 area labels и 1–2 leaders. CSS placement использует
собственный размер элемента и не читает layout синхронно в pointermove. Тест
может читать DOM rectangles после settled frame; production — нет.

Security и HA actions не затронуты: элементы pointer-inert, новых строк/URL/
HTML-ввода нет. Текст проходит существующие formatter/Lit boundaries.

Touch — best effort, без изменения существующей поддержки; cancellation safety
остаётся блокирующей.

## 15. Риски и митигации

1. **Плашка узкой комнаты визуально окажется в соседнем помещении.** Это
   сознательно принято владельцем. Короткая leader line и сторона moving wall
   являются обязательной связью; скрытие/обрезка запрещены.
2. **Winding и обратное направление shared edge перепутают стороны.** Сторона
   вычисляется по candidate polygon interior и покрывается зеркальными unit
   fixtures.
3. **Highlight перехватит жест или перекроет проём.** Слой pointer-transparent и
   расположен ниже opening symbols/handles.
4. **Консервативный footprint разойдётся с фактическим CSS.** Размеры выводятся
   из общих tokens, а smoke сравнивает реальные `getBoundingClientRect()` в
   horizontal/vertical и narrow fixtures.
5. **Forced reflow на каждом pointermove.** Production placement не измеряет
   DOM; mutation/code review стережёт отсутствие `getBoundingClientRect()` в
   gesture path.

## 16. Откат

Одна frontend-ревизия: вернуть старую форму `_rszLive` и прежний render без
measured-edge/leader layers. Данных и миграции нет, backend откатывать не нужно.
Откат возвращает прежние три длины и площадь в центре комнаты; это допустимая
техническая деградация, а не повреждение плана.

## 17. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #300;
- `docs/USER-GUIDE.ru.md` и `docs/USER-GUIDE.md`: Resize показывает две
  меняющиеся длины у подсвеченных стен и площадь у moving wall;
- `docs/RESIZE.md` и `docs/ARCHITECTURE.md`: projection/layer/lifecycle;
- reviewed light/dark active-Resize golden. Baselines принимаются только
  `npm run golden:accept -- --reviewed` из полного Linux CI artifact с
  обязательными `Release:` и `Baseline-Reviewed:` trailers;
- любая правка `src/**` обновляет screenshot fingerprint. Если
  `node scripts/check-docs.mjs` требует пересъёмку, запускается `Docs
  screenshots`, а полный artifact принимается через
  `npm run docs:accept -- --reviewed --from=<artifact>`;
- pre-beta: полный golden/smoke/performance по общему процессу.

## 18. Принятые предположения (техническое, менять свободно)

1. Новый pure helper живёт в `src/resize-labels.ts`; допустимо оставить его в
   существующем Resize module, если импортный граф и тестируемость лучше.
2. CSS gap равен 12 px — существующий размер opening-dimension labels и
   достаточно короткая визуальная связь. Reviewer может скорректировать число
   без продуктового вопроса, сохранив противоположные полуплоскости.
3. Leader рисуется всегда, а не только после определения выхода за polygon.
   Это избегает forced layout read и сохраняет стабильную ownership-связь без
   визуального переключения режима во время drag.
4. Collision helper использует консервативную расчётную ширину текста и
   zoom-dependent footprint room gear для текущего `view.w`, согласованный с
   `iconCqw()`. Допустима другая pure screen-space стратегия, если кнопка
   остаётся видимой, фактические rectangles не пересекаются на default и
   non-default zoom и pointermove не читает layout.
5. Highlight использует два screen-fixed strokes (halo + accent); точные
   ширины являются темизацией, не продуктовым решением.

Не являются предположениями: отсутствие moving-wall length, две подсвеченные
соседние стены, area по обе стороны shared wall, всегда видимая narrow-room
площадь с leader и отсутствие overlap с видимой room settings button — это
acceptance contract.
