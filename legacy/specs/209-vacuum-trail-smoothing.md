# Issue #209 — плавный след пылесоса

- Дата: 2026-08-28
- Тип: feature · приоритет P3
- Оценка: пользовательская ценность 4/10 · ценность для разработки 2/10 · сложность 3/10 · риск 5/10
- Issue: [#209](https://github.com/Matysh/houseplan-card/issues/209)
- Ветка: `issue/209-vacuum-trail-smoothing`

Канонические документы: `docs/SCOPE.md`, `docs/VACUUM.md`,
`docs/USER-GUIDE.ru.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Домочадец либо пользователь настенного киоска смотрит на текущую или последнюю
уборку в View. Телеметрия приходит дискретными точками, поэтому существующая
линия заметно ломается на каждой точке и выглядит менее естественно, чем
фактическое движение робота.

Администратор видит тот же результат в обычном View после настройки источника и
калибровки. Редакторы не показывают след и этой задачей не меняются.

## 2. Что человек увидит до и после

**До:** текущий и предыдущий следы состоят из прямых отрезков с резкими
углами в телеметрических точках.

**После:** те же маршруты показаны плавными кривыми с мягкими поворотами. Кривая
не отходит от исходной ломаной более чем на 17,5 см, не соединяет разрывы и не
опережает движущийся значок пылесоса.

## 3. Проблема

`_renderVacuums()` строит текущий маршрут командами SVG `M`/`L`, а предыдущий —
отдельным `polyline`. Это создаёт две реализации одной визуальной геометрии и
делает каждый дискретный поворот резким. Наивный Catmull–Rom или другой
интерполирующий сплайн неприемлем: на неравномерно прореженных данных он способен
далеко выйти за фактический маршрут, пересечь стену либо визуально отметить не
убранную область.

Изменение должно оставаться представлением существующих точек. Источник данных,
их хранение, нормализация, приоритет, прореживание и lifecycle уборки не меняются.

## 4. Scope

- сгладить текущий видимый след на всех поверхностях, где он уже рисуется;
- тем же способом сгладить предыдущий run в режиме `always`;
- заменить отдельную `polyline`-ветку previous на общий pure builder SVG-path;
- ограничить сглаживание фиксированным радиусом 17,5 см в координатах плана;
- сохранить точные endpoints каждого подпути и буквальные разрывы между ними;
- сохранить casing/core, current/previous opacity и все trail modes;
- покрыть геометрию pure unit-тестами, production-bundle smoke и новой golden-сценой
  с детерминированным сохранённым маршрутом;
- документировать новый визуальный контракт.

## 5. Non-scope

- изменение `VacPath`, backend Store, `trails.py`, калибровки или матрицы;
- добавление/удаление/перестановка сохранённых телеметрических точек;
- изменение лимитов 64 подпути / 4000 точек / 600 локальных точек;
- изменение `resolveCurrentVacPath()`, `trimVacPathTarget()`, trail modes,
  30-минутного resume grace или приоритета integration → server → local;
- UI-настройка степени сглаживания либо возможность его выключить;
- сглаживание движения puck, изменение live tip, толщины, цветов или opacity;
- добавление следа в редакторы или на поверхности, которые его сейчас не имеют;
- реконструкция маршрута, устранение телепортов, collision-aware обход стен;
- изменение room-cleaning highlight и прочих vacuum overlays.

## 6. Контракт поведения

### 6.1 Единицы и порядок преобразований

Ограничение `17,5 см` переводится в единицы текущего пространства единственным
существующим масштабом `gridPitch / cellCm`. Сначала каждая vacuum-точка проходит
существующую affine-калибровку в плоские координаты плана, затем строится
сглаженная геометрия. Только после этого все её точки проходят существующую
проекцию `_scenePoint()` для flat/iso-рендера.

Так предел измеряется в физическом плане, а не в экранных пикселях и не меняется
от zoom, размера карточки, DPR, темы или проекции. Для изометрии сохраняется
проекция той же плоской кривой; отдельного изометрического коэффициента нет.

### 6.2 Ограниченное скругление угла

Для подпути `A…B…C` каждая валидная внутренняя вершина `B` скругляется локально:

1. `r = min(17,5 см в единицах плана, |AB| / 2, |BC| / 2)`.
2. На `AB` выбирается `P` на расстоянии `r` от `B`, на `BC` — `Q` на расстоянии
   `r` от `B`.
3. До `P` идёт прямая; участок `P → Q` рисуется quadratic Bézier с control `B`;
   затем продолжается следующий участок.
4. Первая и последняя исходные точки остаются точными endpoints. Две точки дают
   обычную прямую без curve-команды.

Кривая лежит в convex hull `P–B–Q`; каждая точка этого hull находится не далее
`r` от исходной вершины `B`, которая принадлежит исходной ломаной. Поэтому
расстояние от новой кривой до исходного маршрута не превышает 17,5 см.
Ограничение через половины соседних отрезков не позволяет скруглениям соседних
вершин поменяться местами на коротком сегменте.

Нулевая/неfinite длина, совпадающие точки и разворот примерно на 180° не
сглаживаются в этой вершине и безопасно остаются прямыми. Почти прямой ход может
быть представлен curve-командой, но визуально обязан оставаться на той же
прямой. Builder не выдаёт `NaN`/`Infinity` и не создаёт петли.

### 6.3 Подпути, current/previous и live tip

- Каждый нормализованный подпуть начинается отдельной `M`; между подпутями нет
  `L`, `Q`, `C` или иной синтетической связи.
- `trimVacPathTarget()` выполняется до сглаживания ровно в существующих случаях.
  После trim последняя оставшаяся точка остаётся точным endpoint кривой.
- Live tip остаётся отдельной нулевой линией и стартует из этого endpoint, как
  сейчас; кривая не может уйти к текущей target-точке раньше puck.
- Previous run проходит `normalizeVacPath()` и тот же builder. Его `<g
  class="prev">`, opacity и пара case/core сохраняются; меняется только
  `polyline` на `<path>`.
- Case и core получают буквально одинаковый `d`.

### 6.4 Состояния отображения

Сглаживание включено всегда и не добавляет настройки. Матрица видимости прежняя:

| Условие | Результат |
|---|---|
| `trail_mode: never` | Нет current и previous. |
| `cleaning` + moving | Сглаженный current согласно текущему source authority. |
| `cleaning` + not moving | След скрыт. |
| `always` | Сглаженный доступный current и сглаженный previous. |
| hidden/deleted/HA-disabled/static icon | Следа нет. |
| Нет telemetry/calibration/drawable path | Следа нет, без ошибки. |

## 7. UX, accessibility, touch и i18n

Новых controls, текстов, фокуса, keyboard/touch-жестов и screen-reader сущностей
нет. View и киоск получают один результат; hover и pointer modality не влияют на
форму линии. `prefers-reduced-motion` не относится к задаче: это статическая
форма, а не анимация.

Новых i18n-ключей нет. Поведение одинаково для RU/EN/DE и всех тем. Existing
case/core обязаны сохранить читаемость на светлой, тёмной и цветной заливке.

## 8. Модель данных, совместимость и миграция

Config, Store и HA payload не меняются; новых полей и schema migration нет.
Любой старый план автоматически получает сглаженный визуал для существующих
точек. Экспорт/импорт и downgrade совместимы: старая версия покажет ту же
геометрию снова ломаной, не потеряв данные.

## 9. Архитектура и производительность

`src/vacuum.ts` получает один pure, renderer-independent builder представления
пути. Он принимает уже откалиброванные плоские `VacPath` и предел в единицах
плана, возвращает типизированные команды `move | line | quadratic`, не знает о
Lit, SVG DOM, `cellCm`, flat/iso и CSS. `src/houseplan-card.ts` остаётся владельцем
scale/projection/serialization и использует builder для current и previous.

Обработка — один линейный проход `O(points)`, память `O(points)`. Dense
resampling запрещён. Для `N` входных точек builder создаёт не более `2N`
рисуемых команд; сохранённые точки не копятся между рендерами. Нормализация и
cap выполняются до builder, поэтому верхняя граница остаётся 4000 точек.

Рендер не добавляет timer, animation frame или network/backend work. Existing
Full Performance остаётся release-gate; отдельный runtime feature flag не нужен.

Security/privacy boundary не меняется: новых данных, сервисов, permissions,
логов и внешних ресурсов нет.

## 10. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | У подпути с поворотами внутренние углы представлены quadratic-командами; первая и последняя исходные точки совпадают с endpoints результата. | Pure unit. |
| AC2 | Ни одна выборочная точка кривой не дальше 17,5 см от исходной ломаной; правило сохраняется при коротких и резко неравномерных отрезках. | Табличный unit с численным sampling и переводом `cellCm/gridPitch`. |
| AC3 | Несколько подпутей сохраняют ровно столько `M`, не получают межсегментного bridge и независимо сохраняют endpoints. | Pure unit + production-bundle smoke. |
| AC4 | 0/1-точечные, 2-точечные, duplicate, non-finite и 180° cases не дают петли, `NaN` или `Infinity`; drawable straight path остаётся drawable. | Pure edge-case matrix. |
| AC5 | Current проходит прежнюю arbitration/normalization/trim цепочку; движущийся server/integration trail заканчивается на прежней предпоследней target-точке, а tip остаётся приклеен к puck. | Existing + расширенный `smoke_vacuum.mjs`. |
| AC6 | Previous в `always` использует `<path>` и тот же builder/предел; current и previous case/core имеют попарно одинаковый `d`, прежние classes/opacity сохраняются. | Production-bundle smoke. |
| AC7 | Матрица `never/cleaning/always`, hidden, static icon, unknown map и absent telemetry не меняется. | Existing targeted vacuum smokes. |
| AC8 | Flat View и iso View показывают проекции одной сглаженной плоской геометрии; zoom/DPR не меняют физический предел. | Unit projection invariant + `smoke_isometric_live_touch.mjs`. |
| AC9 | Детерминированный сохранённый маршрут с прямыми, 90°/острыми поворотами и разрывом визуально плавный, не соединяет разрыв и читается в case/core. | Новая golden-сцена desktop dark; baseline принимается только из reviewed Linux CI. |
| AC10 | 64 подпути / 4000 точек обрабатываются линейно, finite, без resampling и с не более `2N` командами; release performance gate остаётся зелёным. | Structural/max-budget unit + Full Performance перед стабильным релизом. |
| AC11 | Рабочие гейты зелёные и tracked bundle синхронизирован. | typecheck, unit, build+bundle compare, selected smokes, no-new-any, check-docs, golden CI. |

## 11. План автотестов и реализации

1. В `src/vacuum.ts` добавить тип команд и pure bounded-corner builder.
2. В `test/vacuum.test.mjs` проверить endpoints, 17,5-см bound численным
   sampling quadratic, gaps, short/duplicate/reversal/non-finite cases и budget.
3. В `_renderVacuums()` сначала affine-преобразовать подпуть, вызвать builder с
   `this._cmToUnits(17.5)`, затем проецировать и сериализовать typed commands.
4. Перевести previous с `polyline` на общий path pipeline; сохранить classes.
5. Актуализировать `demo/smoke_vacuum.mjs`: не считать `M/L` равными числу
   точек, а проверять semantics (`M`, `Q`, endpoints, gaps, trim, previous path,
   paired `d`, opacity, tip). Сохранить проверки source authority и modes.
6. Расширить изометрический smoke проверкой curved path/projection.
7. Добавить отдельную golden matrix scene с сохранённым real-shape fixture;
   baseline локально не принимать — получить и review в Linux CI.
8. Запустить `node scripts/smoke-select.mjs --base origin/dev --head HEAD` и все
   перечисленные им обязательные smokes, плюс `smoke_vacuum.mjs` и
   `smoke_isometric_live_touch.mjs` независимо от selector.

Мутационный guard должен заменить bounded builder прямыми `L` либо убрать
quadratic branch; focused unit/smoke обязан стать красным. Если существующий
mutation framework не поддерживает локальную мутацию без ложного diff, отдельный
guard script допускается в скоупе задачи.

## 12. Риски и меры

| Риск | Мера |
|---|---|
| Кривая отмечает место, где робот не был | Доказанный предел 17,5 см в plan coordinates, без unconstrained spline. |
| Срез угла пересекает стену | Предел равен половине типичного диаметра робота; collision-aware reconstruction вне scope. |
| Разрыв превращается в линию | Typed per-subpath commands и AC3. |
| След опережает puck | Trim до builder, точный endpoint и существующий tip, AC5. |
| Previous и current выглядят по-разному | Один builder и один serializer, AC6. |
| Короткие/повторные точки дают петли | Degenerate/reversal fallback и AC4. |
| 4000 точек замедляют View | Линейный builder без resampling, command bound и performance gate. |
| Iso нарушает физический предел | Сглаживание до affine scene projection, AC8. |

## 13. Release-артефакты и rollback

Изменение пользовательское. Implementation-коммит имеет `User-Visible: yes` и
включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #209;
- `docs/VACUUM.md` и vacuum-раздел `docs/USER-GUIDE.ru.md`;
- `docs/ARCHITECTURE.md` — единый bounded path builder;
- `docs/TESTING.md` — pure/smoke/golden coverage;
- `docs/STATUS.md` — фактическую release-линию;
- unit, targeted smokes, mutation coverage и golden scenario;
- синхронные tracked bundle copies после `npm run build`/`bundle:sync`;
- docs screenshots согласно обязательному `check-docs` fingerprint-процессу.

Новых config/schema/i18n/backend/security artifacts нет. Golden baseline
принимается только отдельным reviewed Linux CI artifact по канону.

Rollback — revert implementation-коммита: данные и config не требуют обратной
миграции, след снова станет ломаным. Если regression обнаружен до revert,
изолированно вернуть renderer к существующей `M/L` сериализации можно без
изменения сохранённого пути.

## 14. Принятые решения и технические предположения

1. Владелец принял defaults: предел ровно 17,5 см; сглаживание всегда включено
   без UI-настройки; previous сглаживается тем же способом.
2. Радиус считается после vacuum affine в плоских координатах плана и до
   `_scenePoint()`; это техническое следствие физического контракта.
3. Разворот около 180° не скругляется, чтобы не создавать loop/cusp; точный
   epsilon определяет реализация и фиксирует unit-тестом.
4. Previous проходит `normalizeVacPath()` перед builder, даже если текущий
   backend отдаёт flat points: это сохраняет единый drawable/cap контракт.
5. Сцены, которые сегодня не рисуют vacuum trail, не получают его в #209.
