# Issue #298 — Resize сохраняет wall records на решётке и на carrier

- **Issue:** https://github.com/Matysh/houseplan-card/issues/298
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся
  метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 10/10; ценность для разработки 10/10;
  сложность 7/10; риск 8/10
- **Область:** fixed-topology Resize, exact wall records, live preview/commit,
  grid barrier, real-plan invariant smoke и mutation coverage
- **Модель данных:** schema и model version не меняются; исправляются только
  записи, которые переносит новый Resize-жест
- **Связано:** #253, #277, #289, #291, #293, #297,
  `docs/RESIZE.md`, `docs/WALL-THICKNESS.md`, `docs/CANVAS.md`

## 1. Персона, поверхность, момент и видимый результат

Персона — администратор дома. Поверхность — desktop Plan editor, инструмент
Resize; момент — обычный ресайз стены готового плана. Повреждение копится
незаметно и может проявиться лишь через несколько следующих правок или дней.

**До:** после серии обычных ресайзов случайная стена в другом месте плана вдруг
рисуется другой толщиной или теряет рабочую ручку, хотя её никто не трогал.
**После:** ресайз либо проходит внешне как раньше, либо в редком неоднозначном
случае заканчивается прежним сообщением об ошибке без изменения плана, но
никогда не портит другую стену.

### Подтверждённая причина

Пользователь безопасно сдвигает одну стену комнаты. Moving wall едет
параллельно себе, а две соседние стены меняют длину. После жеста визуально всё
может выглядеть правдоподобно, но запись толщины другой стены получает endpoint,
которого нет ни среди вершин room polygons, ни на границе wall carrier. На
следующем редактировании это проявляется потерей кладки, ошибкой Optimize или
сломавшейся ручкой Resize.

На обеих приложенных к issue реальных fixtures причина подтверждена в
`rekeyWallsAfterMove()`. Для точки `p` на старом ребре helper вычисляет
относительную долю `t`, затем возвращает точку с той же долей на новом ребре.
Когда fixed-topology Resize двигает только один endpoint бокового ребра,
внутренний endpoint wall record тоже пропорционально уезжает. Так `-85`
становится `-82.457`, хотя такой geometry boundary в новом polygon нет.

Текущий commit guard проверяет только мультимножество `cm` и число open spans.
Он не доказывает, что все exact wall records лежат на carriers нового плана,
поэтому повреждённая запись сохраняется.

## 2. Пользовательский результат

Resize продолжает выглядеть и управляться как после #277/#293. Отличие в
сохранённых данных: перемещаются только wall endpoints, для которых существует
однозначное соответствие старой и новой topology vertex. Остальные endpoints
не интерполируются и остаются на своей физической границе. После commit все
записи толщины остаются на grid и на room-wall carriers; последующие Resize,
Optimize и рендер не получают скрытую повреждённую геометрию.

Если lossless correspondence доказать нельзя, кандидат не сохраняется. Live
preview остаётся на последней валидной позиции, а при отсутствии валидной
позиции жест завершается существующей локализованной ошибкой Resize без config
write и Undo entry. Автоматического снапа настоящей off-grid координаты или
догадки по ближайшей стене нет.

## 3. Fixed-topology correspondence

### 3.1 Источник истины

Для каждого затронутого room edge Resize уже имеет параллельную пару
`old edge → new edge` из immutable pre-drag snapshot и exact candidate.
Topology signature гарантирует одинаковое число и циклическую identity
вершин. На этой основе строится таблица соответствия:

`old room vertex → new room vertex`.

В таблицу входят только действительно изменившиеся vertices. Одинаковая
старая точка, принадлежащая двум room copies общей стены, обязана иметь ровно
одну новую destination. Несколько разных destinations означают конфликт и
отменяют кандидат; порядок rooms или wall records не выбирает победителя.

### 3.2 Exact wall records

Пара `a/b` является identity exact wall record; compatibility `key` только
пересчитывается из итогового span.

Каждая исходная exact запись обрабатывается из immutable snapshot:

1. запись делится на атомы в endpoints перекрывающихся затронутых old edges;
2. endpoint атома заменяется только если он равен old topology vertex из
   таблицы correspondence в пределах canonical coordinate epsilon;
3. interior endpoint без vertex correspondence остаётся byte-equivalent —
   относительная доля длины ребра для него не вычисляется;
4. нулевые атомы удаляются, совместимые соседние атомы с одинаковым `cm`
   склеиваются только когда их endpoints точно совпали и они коллинеарны;
5. для каждого изменённого span заново строится compatibility key, а `cm` и
   известные совместимые поля сохраняются.

Длинная запись, пересекающая затронутый и незатронутый пролёты, обязана
разделиться на границе old edge: только endpoint затронутого атома следует за
вершиной. Нельзя affine-масштабировать целую запись или её внутреннюю точку.

### 3.3 Legacy key-only records

Legacy запись без валидных `a/b` не имеет длины и endpoints, поэтому ей нельзя
изобретать атомы. Разрешён только однозначный whole-edge fallback: старый key
точно соответствует целому изменённому edge и переносится на его новый key.
Projected-midpoint перенос по относительной доле запрещён в production Safe
Resize. Если legacy key затронут, но whole-edge соответствие неоднозначно,
кандидат fail closed и не сохраняется. Незатронутые legacy records остаются
byte-equivalent.

Исторический generic scale/rotate helper может остаться для изолированных
pure-тестов старых преобразований, но production Safe Resize обязан вызывать
fixed-topology API. Переиспользование proportional `t` в этом path запрещено.

## 4. Carrier и lattice preflight

После wall rekey, но до принятия live preview, product code проверяет exact
candidate целиком.

Для каждой exact wall entry:

- `a` и `b` конечны и лежат на canonical grid либо отличаются не больше
  действующего near-node storage epsilon;
- весь открытый span между `a` и `b` покрывается непрерывным объединением
  коллинеарных room edges; недостаточно проверить только midpoint;
- нет зазора между carrier atoms и нет участка, принадлежащего только
  продолжению оси за пределами стены;
- compatibility key согласован с итоговыми `a/b`;
- `cm` остаётся в допустимом диапазоне, а мультимножество исходных физических
  значений толщины не теряется.

Проверка допускает одну compact record через несколько смежных коллинеарных
room edges, но не допускает запись через разрыв. Independent partitions не
являются carrier для `space.walls`: их толщина хранится своей partition
geometry. Open spans по-прежнему проходят существующий отдельный rekey и
carrier validation.

`LATTICE_NOISE_STEPS` из измерительного гейта отличает форматный near-node шум
от настоящего off-grid значения. Исправление не округляет авторскую
координату, удалённую от grid: такой candidate отклоняется. Уже сохранённые
старые off-grid records не мигрируют при загрузке и не меняются без жеста.

## 5. Preview, commit и failure semantics

1. Preview каждый раз строится из immutable pre-drag rooms/walls/open spans,
   а не из предыдущего кадра.
2. Fixed-topology mapping и carrier/lattice preflight являются частью одного
   candidate builder, которым пользуются preview и pointerup.
3. `_serverCfg`, history и queued save не меняются до успешного pointerup.
4. Commit принимает только уже показанный exact preview и повторно проверяет
   snapshot/plan signature. Отдельного второго rekey нет.
5. Конфликт correspondence, неоднозначный legacy record либо carrier/lattice
   failure отклоняет кандидат целиком. Частичная запись запрещена.
6. После runtime reject сохраняется последний валидный preview; если валидного
   ненулевого preview не было, config/history byte-equivalent исходному.
7. Undo/Redo восстанавливают rooms, openings, walls и open spans целиком.

Предсказуемый конфликт, который можно доказать в eligibility, должен сделать
handle disabled до pointer capture. Непредсказуемый runtime reject использует
уже существующее сообщение `resize.commit_failed`; новый persisted reason или
новый UX в этой задаче не вводится.

### UX и i18n

Новых контролов, состояний и текстов нет. Enabled/disabled handle, toast и
доступные имена сохраняют существующий контракт #277/#293; новых RU/EN ключей
не добавляется. Меняется только атомарность данных за прежним жестом.

## 6. Scope

### Входит

- fixed-topology rekey exact и legacy wall records;
- endpoint correspondence без proportional interpolation;
- product carrier/lattice preflight до preview/commit;
- точные регрессии обеих fixtures из #298;
- обновление `smoke_edit_walk`/`KNOWN`, mutation и performance evidence;
- canonical Resize/wall-thickness/testing docs и оба changelog.

### Не входит

- изменение eligibility, safe range, pointer UX или topology #277/#293;
- автоматический ремонт уже сохранённого bad plan через Optimize;
- schema migration, integer-coordinate storage либо общий ADR #282;
- смешанные shared/exterior роли #289/#299;
- изменение толщины пользователем, renderer wall union или opening geometry;
- touch parity Plan editor сверх общего safety floor.

## 7. Acceptance criteria

### AC1. Exact repro второго этажа

На `real-plan-second-floor.json` production Resize выполняет указанную в issue
последовательность `room-a`, edge 2, `x=96 → 100` grid steps. Запись исходного
горизонтального span `y=304` сохраняет endpoint на существующей topology
boundary; значение `-85` не превращается в `-82.457` или другую
пропорциональную точку.

После preview и commit нет `off_lattice_coordinate`, `wall_carrier`, wall-key,
reference и physical-geometry нарушений. Moving/shared rooms и openings
сохраняют контракты #277/#293.

**Доказательство:** fixture-backed pure/unit regression и production-bundle
pointer smoke; assert проверяет конкретную identity записи до/после, а не
только отсутствие исключения.

### AC2. Exact repro первого этажа

На `real-plan-first-floor.json` последовательность `room-b`, edge 0,
`x=49 → 52` не создаёт endpoint `59.538` на wall record линии `y=155`.
Итоговые endpoints принадлежат реальным vertices/carrier boundaries
`17/52/57/101` согласно новому candidate.

**Доказательство:** отдельный fixture-backed regression с exact endpoint,
carrier/lattice и unchanged-record assertions.

### AC3. Untouched records действительно не меняются

Table-driven unit покрывает non-shared wall, exact shared pair, длинную запись,
пересекающую moved и untouched spans, reversed orientation и несколько
одинаковых `cm`. Запись без overlap и без moved endpoint остаётся deep/byte
equivalent, включая key и порядок. Затронутые записи сохраняют все значения
`cm`; коллизия destinations отклоняет весь candidate.

### AC4. Legacy compatibility не угадывается

- unambiguous whole-edge key переезжает на новый whole-edge key;
- untouched key-only record не меняется;
- key-only midpoint на части изменившего длину edge не переносится
  пропорционально и приводит к fail-closed candidate;
- exact record всегда использует `a/b`, даже если старый compatibility key
  неверен.

**Доказательство:** pure unit и production-preview reject с нулём config/history
writes.

### AC5. Carrier preflight проверяет весь span

Positive cases: одна room edge и непрерывная цепочка нескольких коллинеарных
room edges. Negative cases: оба endpoints на carriers, но между ними разрыв;
midpoint на продолжении за пределами edge; endpoint на independent partition;
настоящая off-grid coordinate дальше `LATTICE_NOISE_STEPS`; conflicting shared
destinations. Каждый negative candidate отклоняется до сохранения.

**Доказательство:** table-driven unit pure carrier preflight плюс integration
test отказа candidate builder до мутации preview/config.

### AC6. Шесть edit-walk запусков больше не несут этот долг

Проходят:

```text
node demo/smoke_edit_walk.mjs --seed 1 --plan real-plan-second-floor.json
node demo/smoke_edit_walk.mjs --seed 2 --plan real-plan-second-floor.json
node demo/smoke_edit_walk.mjs --seed 3 --plan real-plan-second-floor.json
node demo/smoke_edit_walk.mjs --seed 1 --plan real-plan-first-floor.json
node demo/smoke_edit_walk.mjs --seed 2 --plan real-plan-first-floor.json
node demo/smoke_edit_walk.mjs --seed 3 --plan real-plan-first-floor.json
```

Для результатов Resize нет `off_lattice_coordinate` и `wall_carrier`.
`KNOWN` обновляется в том же implementation-коммите только для исправленных
kinds. Независимый долг `mixed_role_record` #299 не скрывается и не считается
регрессией #298.

### AC7. Preview/commit/Undo атомарны

Valid pointer drag показывает exact candidate до release, затем создаёт ровно
один config write и один Undo entry. Undo возвращает byte-equivalent исходные
rooms/walls/open spans; Redo возвращает тот же exact candidate. Forced carrier
failure даёт ноль writes/history и существующую локализованную ошибку один раз.

**Доказательство:** production-bundle pointer smoke с чтением DOM preview,
persisted config и history до release, после commit, Undo/Redo и forced reject.

### AC8. Мутационный страж

Mutation возвращает proportional `t` mapping для interior endpoint либо
отключает carrier preflight. AC1/AC2 или AC5 обязаны падать. Blanket-disable
Resize не проходит positive pointer scenario AC7 и существующие #293 smokes.

### AC9. Производительность и локальные гейты

Mapping строится один раз на candidate из уже ограниченного набора затронутых
edges. Нельзя добавлять глобальное pairwise сравнение всех records со всеми
room edges на каждый `pointermove` без подготовленного carrier index. p95 budget
Resize из `docs/RESIZE.md` сохраняется; если hot path меняется, targeted
benchmark сравнивается с baseline.

Обязательны:

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- targeted Resize pointer smoke, шесть edit-walk запусков и mutation gate.

Полные golden, smoke, performance и Linux HA harness выполняются перед beta.

## 8. Совместимость, touch и security

Schema/storage/model version не меняются. Старые планы читаются без фоновой
перезаписи; исторический off-grid долг остаётся видимым до явной правки или
отдельного Optimize repair. Новый commit только запрещает Safe Resize создавать
новый долг.

Plan editor остаётся desktop-first. Touch — best effort, но safety floor общий:
single-pointer drag не пишет invalid candidate, pinch/pan, pointercancel и lost
capture не создают config/history entries. Новых HA actions, сетевых запросов,
HTML/CSS input или security boundaries нет.

## 9. Риски и меры

- **Слишком широкий vertex match** может двигать соседний interior endpoint.
  Мера: canonical epsilon, explicit correspondence и exact AC1–AC3.
- **Слишком узкий match** потеряет толщину moved wall. Мера: positive
  non-shared/shared/long-record matrix и `checkWallRecordsPreserved`.
- **Проверка только endpoints/midpoint** пропустит разрыв carrier. Мера: full
  interval coverage AC5.
- **Legacy fallback снова введёт интерполяцию.** Мера: explicit fail-closed AC4
  и mutant AC8.
- **Соседняя #299 меняет тот же `KNOWN`.** Мера: #298 удаляет только два своих
  kinds и при rebase сохраняет независимые mixed-role строки.
- **Новый global validation замедлит pointermove.** Мера: подготовленный index
  и benchmark AC9.

## 10. Откат

Откат — полный revert implementation-коммита вместе с tests/docs/`KNOWN`.
Миграция или восстановление schema не нужны. Конфиги, уже сохранённые новой
версией, используют прежнюю схему и читаются старой версией.

## 11. Ожидаемые файлы и release artifacts

Product code:

- `src/wall-thickness.ts` — fixed-topology rekey;
- `src/houseplan-card.ts` — candidate integration и fail-closed preflight;
- отдельный pure carrier helper допускается, если не дублирует invariant model.

Tests/evidence:

- `test/wall-thickness.test.mjs` и/или targeted Resize unit;
- `demo/smoke_edit_walk.mjs`, включая точное обновление `KNOWN`;
- production-bundle Resize pointer smoke;
- mutation registry и targeted benchmark при изменении hot path.

Документация:

- `docs/RESIZE.md`, `docs/WALL-THICKNESS.md`, `docs/TESTING.md`;
- при изменении архитектурной границы — `docs/ARCHITECTURE.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

Визуальный дизайн не меняется, поэтому новый golden baseline не ожидается.
Если штатный docs screenshot всё же изменится, принимается только artifact
Linux workflow после визуального review и bundle sync.

Implementation-коммит имеет terminal trailers:

```text
Issue: #298
User-Visible: yes
```

Issue не закрывается вручную: она закрывается пакетно при выпуске beta.

## 12. Принятые технические предположения

1. Зафиксированные в issue gestures и tracked real-plan fixtures являются
   достаточным privacy-safe regression input; новые приватные данные не нужны.
2. `space.walls` относится только к room-wall carriers. Independent partitions
   хранят толщину в собственном объекте и не оправдывают wall record вне room
   boundary.
3. Existing `resize.commit_failed` достаточно для редкого runtime reject;
   новый user-facing reason не требуется, пока eligibility не меняется.
4. Near-node storage noise из #291 отличается от настоящего repro #298;
   исправление не расширяет snap tolerance.
