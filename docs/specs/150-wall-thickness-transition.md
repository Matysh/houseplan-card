# Issue #150 — Точная геометрия коллинеарного перепада толщины стен

- **Issue:** https://github.com/Matysh/houseplan-card/issues/150
- **Редакция:** r2 после `SPEC-REVIEW-150-r1`; статус задачи определяется только
  метками issue
- **Тип / приоритет:** bug / P2
- **Оценка:** пользовательская ценность 8/10; ценность для разработки 8/10;
  сложность 7/10, риск 8/10
- **Область:** atomic wall intervals, внешний фасад, wall body/paper/clean floor,
  Plan, View/киоск, static renderer, hidden Iso, Glow и солнце
- **Модель данных:** без изменений и миграции
- **Связано:** `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`,
  `docs/CANVAS.md`, `docs/ISOMETRIC.md`; #123 и #141

## 1. Сценарий и продуктовый контекст

**Персона:** администратор дома, исправляющий архитектуру плана в desktop Plan
Editor.

**Поверхность и момент:** после Split исходной комнаты с нулевыми стенами
пользователь выбирает внешнюю стену одной дочерней комнаты, задаёт `10 см` и
нажимает «Применить ко всем стенам комнаты».

**До → после, без терминов реализации:** сейчас после Split толщина выбранной
комнаты сохраняется правильно, но у точки разделителя не заканчивается и
визуально продолжается по внешним стенам соседней комнаты, для которых задано
`0`. После исправления выбранные участки имеют полные 10 см до точки
разделителя, соседняя комната остаётся без толщины, а граница видна как точная
ступень.

Первоначальное описание «примерно 5 вместо 10» уточнено после ревью. На
скриншоте внутренняя половина внешней стены действительно занимает 5 см, потому
что действующий контракт стены — `centreline ±½`; внешняя половина лежит на
белом поле и читается по штриховке. Полная глубина выбранного участка равна
10 см. Реальный дефект скриншота — отсутствие границы `10 → 0`: штриховка
10-сантиметрового body продолжается снаружи вдоль нулевого фасада соседа.

Задача поддерживает J4 и J6 из `docs/SCOPE.md`: штатное редактирование должно
создавать измеримо правдивую и стабильно читаемую архитектуру.

## 2. Красное воспроизведение на `dev` и подтверждённая причина

На конфигурационном уровне команда уже работает правильно:

- все допустимые atomic intervals выбранной комнаты получают `10 см`;
- общий разделитель получает `10 см` как одна физическая стена;
- внешние стены соседней комнаты остаются `0`.

Повторная проверка после `SPEC-REVIEW-150-r1` выполнена на текущем `dev`
`a05aa5d` двумя путями: через фактические обработчики Plan Editor
`_splitClick()` → `_wallThickClick()` → `_wallThickApply(true)` и через
исполняемые `setWallThicknessForRoom()` → `wallIntervals()` →
`wallBodiesGeometry()` с production-параметром `coordScale = 1000`.

Красный fixture: прямоугольник `[100,100]–[900,900]`, вертикальный Split в
`x = 500`, слева `10 см`, справа `0`, разделитель `10 см`. Данные дают:

- левый верхний interval: `cm = 10`;
- правый верхний interval: `cm = 0`;
- divider: `cm = 10`;
- ожидаемая полная глубина: `8.333333` render units.

Но текущий masonry path содержит верхнюю грань
`M 95.833… 95.833… L 900 95.833…`: глубина 10 см протянута через весь правый
нулевой interval до `x = 900`. Поэтому probe на правом участке, например
`[700, 96]`, ошибочно находится внутри masonry, хотя обязан быть вне его.
Сечение выбранного левого участка при этом полное — `8.333333` units; тест,
проверяющий только толстую сторону, дефект не обнаруживает.

Подтверждённая причина находится в `exteriorBoundaryProfile()`. Коэффициент
`t` точки разбиения нормирован на диапазон `0…1`, но сравнивается с `eps` в
render units. При обычных `pitch = 1/240` и `coordScale = 1000` используемый
`eps` равен примерно `0.6667`; проверки `t > eps && t < 1 - eps` становятся
невыполнимыми, а дедупликация `t` тем же допуском также размерностно неверна.
Breakpoint `x = 500` после boolean union не материализуется, и весь
коллинеарный edge получает depth того interval, на который попал его midpoint.
Воспроизведение обязано использовать production scale; проверка с
`coordScale = 1` не ловит ошибку.

Это не дефект сохранения команды «Применить ко всем», не изменение семантики
`centreline ±½` и не исправляется дублированием wall key, CSS stroke или
визуальной накладкой только в Plan.

## 3. Решения владельца

Владелец 15.08.2026 принял defaults Q1–Q4. Каноническая запись:
https://github.com/Matysh/houseplan-card/issues/150#issuecomment-5301107134

1. Выбранная комната получает полные 10 см на внешних участках вплоть до
   разделителя; общий разделитель — 10 см; остальные внешние стены соседней
   комнаты — 0.
2. На общем внешнем фасаде переход точный и ступенчатый на endpoint
   разделителя, без сужения, растягивания на соседа или taper.
3. Инвариант действует для любых соседних коллинеарных интервалов разной
   толщины (`10 → 0`, `10 → 20` и т. п.).
4. Исправляется общая каноническая геометрия Plan, View/киоска, static, hidden
   Iso/floor footprint и препятствий Glow/солнца; существующие конфиги
   исправляются без миграции.

## 4. Скоуп

В задачу входят:

1. все пары соседних collinear exterior atomic intervals с неравной допустимой
   толщиной, включая один нулевой;
2. точная граница перепада в сохранённом atomic endpoint;
3. сценарий endpoint разделителя после Split и аналогичная топология,
   независимо от направления, winding, room id и порядка комнат;
4. полная толщина каждого участка, корректные inward/outward faces и clean
   floor по обе стороны перехода;
5. корректное соединение с общей стеной/разделителем, заканчивающейся в той же
   точке;
6. единая masonry/paper geometry для всех render/light consumers;
7. уже сохранённые планы без config rewrite;
8. unit, browser smoke, visual golden, документация и RU/EN changelog.

## 5. Не входит в задачу

- изменение UX или семантики «Применить ко всем стенам комнаты»;
- изменение выбора atomic interval, диапазона толщины или wall key format;
- автоматическое выравнивание толщины соседних комнат;
- плавный bevel/taper между коллинеарными участками;
- новая пользовательская настройка вида перехода;
- изменение Split, Merge, Resize или Boundary как редакторских операций;
- исправление произвольных near-miss, X-crossing или независимых junctions,
  которые относятся к #141;
- изменение фасадного инварианта corner Split из #123;
- миграция, schema version, backend, import/export или materialisation на read;
- отдельная wall model для Iso или света;
- изменение opening semantics, кроме обязательного отсутствия регрессии на
  opening, расположенном рядом с перепадом.

## 6. Каноническая математическая семантика

### 6.1. Atomic intervals

Максимальная collinear boundary разбивается во всех структурных точках:

- endpoints исходных room edges и дочерних edges после Split;
- endpoints точных `WallEntry.a/b` и совместимых legacy breaks;
- начало/конец `open_spans` и physical opening coverage, когда они создают
  действующую атомарную границу;
- junctions и точки изменения effective thickness.

Каждый получившийся solid interval имеет постоянную effective thickness `cm_i`
и half-depth

```text
h_i = wallCmToUnits(cm_i, cell_cm, grid_pitch) / 2
```

Zero interval (`cm_i = 0`) остаётся границей пола, но не создаёт masonry body.
Ни порядок комнат, ни midpoint compacted key не могут удалить точный breakpoint.

### 6.2. Полная толщина участка

Для любой точки внутри solid interval, расположенной дальше geometry epsilon
от его endpoints и openings, сечение wall body по нормали к centreline обязано
иметь:

- полную глубину `2 × h_i`, соответствующую `cm_i`;
- внутреннюю грань на `h_i` от centreline;
- внешнюю грань на `h_i` от centreline;
- отсутствие удвоения или потери alpha/hatch из-за перекрывающихся room rings.

Допуск используется только для численной устойчивости и не может объяснять
видимое сужение 10 см до 5 см.

### 6.3. Жёсткая ступень `h1 → h2`

Пусть два соседних collinear intervals встречаются в точке `P`, имеют
half-depth `h1` и `h2`, `h1 != h2`.

1. До `P` обе faces находятся ровно на `±h1`; после `P` — на `±h2`.
2. Разность глубин закрывается в `P` сегментами, перпендикулярными centreline.
3. На ненулевой длине вокруг `P` нет линейной интерполяции, mitre вдоль прямой,
   taper, усреднения, overshoot или распространения большего `h` на соседа.
4. Breakpoint в результирующей geometry совпадает с `P` в пределах общего
   geometry epsilon.
5. Правило симметрично для `0 → h`, `h → 0`, `h1 → h2`, обратного направления
   boundary и любого winding.
6. Boolean cleanup может объединить совпадающие рёбра, но не имеет права
   удалить поперечные faces ступени или сдвинуть их от `P`.

### 6.4. Endpoint разделителя

Если в `P` к фасаду примыкает shared wall после Split:

- shared wall сохраняет полную назначенную толщину и одну physical identity;
- её тело заканчивается/соединяется с внутренней частью фасада без щели;
- она не выступает наружу и не изменяет exterior face фасада, как требует
  контракт #123;
- внешний interval выбранной комнаты сохраняет `h_selected` до `P`;
- соседний внешний interval начинает собственный `h_neighbor` непосредственно
  после `P`;
- соединение не оставляет triangular notch, half-depth strip, двойной hatch или
  ложный passage для света.

Для сценария issue это означает `10 см exterior → P → 0 см exterior`, при этом
shared divider в `P` имеет `10 см` и остаётся внутри facade envelope.

### 6.5. Clean floor и paper

- paper footprint растёт наружу по локальному `h_i` и повторяет ту же ступень;
- clean floor каждой комнаты отступает внутрь по её effective local half-depth;
- выбранная комната не получает клин пола между 10-сантиметровой стеной и
  разделителем;
- соседняя комната с `0` сохраняет floor до centreline своего внешнего участка;
- displayed area вычисляется из исправленного clean floor без изменения
  centreline room polygon или stored area data;
- courtyard/nested geometry сохраняет действующий evenodd/topology contract.

## 7. Архитектурный контракт реализации

Конкретный helper и boolean primitive выбирает автор, но обязательны границы:

1. `wallIntervals()`/эквивалент остаётся каноническим источником interval
   endpoints и effective `cm`.
2. Exterior profile обязан материализовать каждый thickness breakpoint до
   offset/union и сохранить две независимые face depths в этой точке. Обычный
   polygon vertex с одним offset, не способный выразить discontinuity, не
   является достаточным представлением.
3. Допустимые решения — interval slabs/quads с точными butt faces, профиль с
   duplicated transition vertices/explicit step faces или эквивалентная
   детерминированная конструкция. Рисование corrected CSS stroke поверх
   ошибочного body запрещено.
4. Настоящие non-collinear фасадные углы продолжают использовать действующий
   bounded mitre/bevel (`MITRE_LIMIT`); collinear thickness step не является
   углом для mitre.
5. Shared/internal bodies сначала ограничиваются interior side exterior
   envelope, затем объединяются с точным shell — инвариант #123 не ослабляется.
6. Один результат `wallBodiesGeometry()`/эквивалента порождает masonry path,
   paper path, clean-floor relation и light/sun barriers. Static и full card
   не имеют отдельных корректирующих веток.
7. Iso потребляет тот же canonical masonry/floor footprint и экструдирует уже
   правильный stepped outline; самостоятельное сглаживание ступени запрещено.
8. Порядок комнат, stable id rename, winding и направление интервала не меняют
   геометрическое множество результата.
9. Новая топология входит в существующий structural fingerprint/cache. HA
   state tick, hover и activity effects не запускают boolean rebuild.
10. При boolean failure действует существующий fail-closed contract: нельзя
    воскресить raw per-room rings, известные half-depth/facade дефектом.

## 8. Openings, виртуальные границы и junction regression contract

Задача не меняет типы проёмов, но исправленная geometry обязана сохранять:

- opening association с фактическим atomic interval;
- full-depth cut и jamb по локальной толщине каждой покрытой части;
- при crossing thickness transition — точный stepped tunnel без cut соседнего
  interval и без neutral-paper leak;
- window/door/gate light semantics из `docs/WALL-THICKNESS.md`;
- virtual `open_span` как реальный break, а не мост для переноса большей
  толщины;
- примыкания независимых partitions/drafts/columns по контракту #141;
- corner Split exterior envelope по контракту #123.

Если opening не может быть однозначно связан после исправления, действует
существующий fail-dark/fail-closed путь; новая nearest-wall эвристика не
вводится.

## 9. Поверхности-потребители

Одинаковое геометрическое множество требуется для:

1. Plan Editor, включая hover/selection Thickness поверх фактического body;
2. View и kiosk full renderer;
3. `houseplan-space-card`/static renderer;
4. hidden Iso wall volume, top face и floor slab footprint;
5. room fill и clean-floor clipping;
6. displayed clean area;
7. Glow/spill occluders и placement checks;
8. sun barriers/wedges;
9. paper/content frame, когда внешняя половина стены расширяет план.

Разница только из-за presentation policy (например, hatch suppression при
малой экранной толщине) допустима; physical outline и проходы должны совпадать.

## 10. Модель данных, compatibility и миграция

Формат остаётся прежним:

```ts
interface WallEntry {
  key: string;
  cm: number;
  a?: number[];
  b?: number[];
}
```

- новые поля, aliases и schema version не добавляются;
- точные `a/b` и legacy midpoint-only keys читаются по действующему contract;
- normalisation/materialisation выполняются только при явном редактировании,
  как сейчас;
- открытие/рендер старого плана не вызывает save и не переписывает config;
- backend validation, import/export и wire payload не меняются;
- rollback возвращает прежний renderer без потери данных, хотя визуальный
  дефект снова проявится.

## 11. UX, i18n, accessibility и touch

Controls, dialogs, tool sequence, labels и focus не меняются. Новые locale keys
не требуются.

Plan Editor остаётся desktop-first. **Touch editor: best effort / intentionally
degraded.** Safety floor обязателен: тот же сохранённый config на touch не может
получить другую физическую геометрию из-за pointer type. View и kiosk fully
supported и обязаны показывать тот же полный stepped body.

`prefers-reduced-motion` не затрагивается. Исправление geometry не добавляет
animation и не использует цвет как единственное доказательство толщины.

## 12. Acceptance criteria

1. **[unit]** Production-scale fixture из §2 сохраняет data profile `10 см` на
   внешних стенах выбранной комнаты и shared divider, `0` на внешних стенах
   соседа; тест явно передаёт `coordScale = 1000`.
2. **[unit]** Нормальное сечение каждого 10-сантиметрового участка до endpoint
   имеет полные 10 см: 5 см наружу и 5 см внутрь, в численном пересчёте render
   units.
3. **[unit + golden]** На endpoint разделителя фасад меняется `10 → 0` точной
   поперечной ступенью; probes на нулевой стороне находятся вне masonry, нет
   taper, переноса 10 см на соседа, зуба или щели.
4. **[unit]** Матрица `0 ↔ 10`, `10 ↔ 20`, `1 ↔ 100` и равных толщин корректна
   в обоих направлениях, при обратном winding и перестановке/переименовании
   комнат.
5. **[unit]** Shared divider сохраняет полную толщину, соединяется внутри и не
   расширяет фасад наружу.
6. **[unit]** Paper, clean floor и displayed area следуют локальным depths и
   точной ступени без клина/утечки пола.
7. **[smoke + golden]** Plan, View/kiosk, static и hidden Iso имеют одинаковый
   wall/floor outline; Glow и солнце блокируются ровно нарисованным body.
8. **[unit + smoke]** Openings около/через transition используют локальные
   depths и не создают ложных cuts или двойной fill.
9. **[unit + smoke]** Регрессии #123 (corner Split facade) и #141 (independent
   junctions) остаются закрытыми; nested/courtyard/open-span fixtures не
   меняются ошибочно.
10. **[unit + ревью кода]** Старый config исправляется вычисляемо без
    save/migration и остаётся совместимым с rollback.
11. **[unit + ревью кода]** Structural geometry кешируется; ordinary HA tick не
    повторяет topology.
12. **[unit + ревью кода]** Boolean failure остаётся fail-closed и не
    воскрешает raw per-room rings.

## 13. Проверки и доказательства

### Unit — данные и точная геометрия

- красный production-scale fixture из §2: Split rectangle, all walls `0`,
  all-room `10` для одной child room; assert effective intervals, shared wall
  ownership, полную толстую сторону и отсутствие masonry probes на нулевой
  стороне;
- отдельная нормализованная вариация с `coordScale = 1` не заменяет fixture с
  `coordScale = 1000`;
- cross-section/point containment на interior участках доказывает exact
  `±h_i`, а не только сравнивает bbox/скриншот;
- transition faces совпадают с divider endpoint и перпендикулярны centreline;
- parameter matrix `0/1/10/20/100`, оба направления, horizontal/vertical/45°;
- room order/id/winding invariance через symmetric-difference area;
- equal neighbouring depths не создают лишнюю seam/step;
- shared divider: no exterior difference сверх локального exterior profile;
- paper geometry и clean-floor areas по обе стороны;
- opening до, после и пересекающий transition;
- #123 corner Split, #141 virtual/independent junction, open spans,
  nested/courtyard и boolean failure regressions;
- full/static/Iso consumers получают один fingerprinted canonical result.

### Browser smoke

1. В Plan повторить пять шагов issue и визуально/инструментом проверить каждую
   стену выбранной и соседней комнаты.
2. Переключить Plan → View → kiosk/static fixture → hidden Iso без изменения
   silhouette/step.
3. Проверить Undo/Redo all-room thickness: одна команда возвращает прежний
   профиль, повтор применяет исправленную geometry.
4. Добавить opening рядом с transition и проверить cut/fill/Glow.
5. Изменить HA light state: topology fingerprint и masonry path не меняются.

### Golden и performance

- golden исходного issue крупным планом в Plan и View;
- static и hidden Iso того же fixture;
- `10 → 20`, 45° transition, opening near transition, light/sun state;
- diff review проверяет именно ступень и полную толщину, а не массовое
  обновление anti-aliasing;
- performance evidence подтверждает отсутствие geometry rebuild на HA ticks и
  отсутствие существенной регрессии canonical pass на representative plan.

Golden, smoke и performance запускаются в release gate перед бетой; цикл
реализации — `typecheck`, `unit`, `build` по процессу. Полный HA harness
каноничен в Linux CI.

## 14. Release-артефакты

В том же user-visible коммите реализации обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/WALL-THICKNESS.md` — явный контракт collinear discontinuity;
- `docs/ARCHITECTURE.md` — canonical interval/step representation и consumers;
- при необходимости `docs/ISOMETRIC.md` и `docs/CANVAS.md`, если комментарии о
  footprint требуют уточнения;
- `docs/USER-GUIDE.ru.md` — только если там описан отличавшийся результат
  all-room thickness; новых controls нет;
- unit fixture, smoke scenario и принятые golden/baselines;
- `docs/TESTING.md`, если меняется или добавляется release scenario.

Новых i18n, backend/security artifacts не требуется. Если реализация потребует
формат данных или отдельную пользовательскую настройку, задача возвращается
владельцу до кода.

## 15. Риски и rollback

Основные риски: новый внешний зуб вместо half-depth, потеря floor hole,
расхождение full/static/Iso, ошибочный opening cut и рост boolean cost. Они
закрываются symmetric-difference, cross-section, consumer parity и performance
проверками раздела 13.

Rollback — возврат geometry-кода и документации без миграции. Сохранённые
`walls` не изменяются и остаются читаемыми обеими версиями.

## 16. Принятые технические предположения

1. Breakpoint уже доступен из точных atomic intervals; исправлению не нужен
   новый persisted vertex или WallEntry field.
2. Ступень существует на обеих faces wall body. При `h2 = 0` обе faces второго
   участка сходятся на centreline ровно в `P`, а не заранее.
3. Поперечная face в transition является частью physical boundary, но не новым
   самостоятельным wall object и не target инструмента Thickness.
4. Opening, пересекающий transition, остаётся допустимым и режет union реальных
   локальных depths; запрет такого opening не является исправлением.
5. Existing structural cache key на `_cfgEpoch`/complete geometry расширяется
   только если текущий fingerprint не содержит всех endpoints/thicknesses.
