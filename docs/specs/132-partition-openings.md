# Issue #132 — проёмы в независимых перегородках

- **Issue:** https://github.com/Matysh/houseplan-card/issues/132
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** feature, обычный трек
- **Пользовательское изменение:** да

## 1. Сценарий

Администратор рисует независимую перегородку в Plan editor и размещает в ней
реальную дверь, окно или ворота тем же инструментом «Проём», которым работает со
стенами комнат. Домочадцы затем видят корректный разрыв, live state и действия в
View/kiosk.

## 2. Что человек увидит до и после

До изменения перегородка остаётся сплошной и не принимает проём; после изменения
выбранный door/window/gate вырезает её тело, следует за перегородкой и ведёт себя
как тот же тип проёма в обычной стене.

## 3. Проблема и связь со scope

`partitions[]` — канонические независимые физические стены, но current opening
placement/index принимает только derived room walls. Physical union специально
добавляет partitions после opening cuts, поэтому проём не может вырезать их.

Функция закрывает J4: администратор может без внешнего SVG точно воспроизвести
план. Правильный итоговый View также поддерживает J1/J2/J3: физическая геометрия,
contact/lock status и безопасные actions не расходятся с домом.

## 4. Решения владельца

1. На перегородке разрешены существующие `door`, `window`, `gate`; новый тип
   «открытый проход» не добавляется.
2. Проём следует за host при движении перегородки.
3. Удаление перегородки с проёмами требует confirmation со списком и удаляет их
   только после явного согласия.
4. Contact, lock, badges и actions идентичны одноимённому проёму в room wall;
   меняется только host geometry.
5. Физический passage в перегородке участвует в световой геометрии по тем же
   type-specific правилам, что passage в стене.

## 5. Scope

- явная persisted host identity для partition opening;
- placement/hover/drag/edit/delete door, window и gate на partition;
- full-depth cut, jamb/tunnel/symbol geometry с толщиной partition;
- движение/удаление host и единая Undo/Redo команда;
- Flat Plan/View/kiosk/static и hidden Isometric renderers;
- clean floor, Glow barrier/source guard и действующие sun semantics;
- existing opening HA state/actions/security;
- backend validation, import/export/optimization compatibility;
- i18n, user/canonical docs, unit/backend/smoke/golden/performance evidence.

## 6. Не входит в задачу

- новый тип «открытый проход» без door/window/gate symbol;
- проёмы в unfinished room drafts или columns;
- несколько host segments на один opening;
- автоматическая конверсия старого room-wall opening в partition opening;
- создание room/Area из partition;
- новая light model либо изменение window/door/gate semantics;
- sun rays, источником которых становится внутреннее partition window;
- полная touch parity Plan editor;
- свободное удаление host с неявной потерей его openings.

## 7. Модель данных и host identity

`OpeningCfg` получает optional host discriminator:

```ts
host?: {
  kind: 'partition';
  id: string;
  t: number;
}
```

- `host` отсутствует — current legacy/current room-wall association по `x/y/
  angle/length`; старые конфиги не мигрируют.
- `kind='partition'` — `id` обязан ссылаться на partition того же space.
- `t` — нормализованное положение центра вдоль направленного `a→b`, `[0,1]`.
- `x`, `y`, `angle` остаются materialized compatibility projection и обновляются
  атомарно из host; новый frontend считает valid host+t authority.
- `length` остаётся normalized physical length и существующий dialog показывает
  cm/in по `cell_cm`.

Если implementation выбирает flat fields вместо object, semantics и
compatibility остаются теми же. Host kind расширяем discriminated union, но #132
добавляет только `partition`.

Backend new writes проверяет: existing partition id, finite `t`, finite geometry,
length fits host с jamb safety margin и total limits. Referentially invalid full
config write отклоняется, чтобы старый client не мог тихо удалить host и оставить
opening.

## 8. Canonical resolved opening

Один pure resolver строит immutable `ResolvedOpeningHost` для всех consumers:

- kind/id;
- directed centreline and normalized unit vector;
- center from `a + t(b-a)`;
- angle modulo current opening convention;
- full length and host depth from partition `cm`;
- validity/orphan reason;
- adjacent floor samples/type-specific passage policy.

Placement preview, symbol, body cut, tunnel, hit test, light barriers, Iso panel,
move/delete и tests используют этот resolver. Запрещён render-only nearest-wall
fallback для explicit partition host.

Если endpoints хоста представлены в обратном порядке при canonical rewrite,
rewrite одновременно заменяет `t → 1-t`, сохраняя physical center и hinge/flip
orientation. Простое rigid translation сохраняет `t`, length и flip.

## 9. Placement UX

Активный инструмент «Проём» рассматривает два host kind:

- solid derived room-wall intervals;
- saved independent partition segments.

Hover preview показывает тот же translucent door/window/gate и привязывается к
partition axis. Center квантуется по действующему wall-bound grid step, length
целиком помещается между endpoints. Click повторно разрешает candidate и открывает
существующий opening dialog.

При близких candidates выбирается минимальная perpendicular distance, затем
полное покрытие opening length; точная неразрешимая tie room-wall/partition
отклоняется с локализованной причиной вместо скрытого выбора другого host.
Existing opening hit имеет приоритет над placement.

Toast `opening_no_wall` обновляется до «стены или перегородки». Virtual room span,
room draft и column остаются невалидными host. Touch placement — best effort;
pointercancel/multi-touch не сохраняют draft по safety floor.

## 10. Толщина, cut и symbol

Partition body строится из centreline и `cm`, half-depth с каждой стороны.
Hosted opening:

- вырезает body на полную глубину ровно по своему reserved interval;
- получает два flat jamb returns на концах cut;
- door swing начинается с выбранной face по `flip_v`;
- window glass располагается в середине partition depth;
- gate leaves используют current compact gate geometry;
- overlapping hosted openings не могут резервировать один interval дважды;
- junction patches после cut не должны заново закрыть passage.

Для zero/invalid thickness new partition невозможна по current validation
(1–100 cm). Malformed legacy host fail-dark: cut не применяется. Room-wall and
partition cuts выполняются по host identity до единого physical union; случайное
совпадение осей не позволяет opening прорезать второй независимый body.

## 11. Floor fill и tunnel

Partition не является границей room ownership. После вычитания hosted opening
видна уже существующая clean-floor/fill geometry под body. Дополнительный
нейтральный paper tunnel не рисуется.

Если partition пересекает две room fills, каждый side сохраняет свою canonical
fill ownership; cut не смешивает alpha и не создаёт новую room. Glow/sun layers
остаются выше base fill. Opening symbol скрывается по `hide_openings`, но physical
cut, HA state и barrier semantics остаются активны, как у room-wall opening.

## 12. Glow и light barriers

Решение владельца «проём пропускает свет» реализуется через type-specific
существующий контракт:

- door/gate — transparent passage только там, где по обе стороны host есть floor;
- exterior/no-floor с одной стороны остаётся opaque, чтобы Glow не уходил наружу;
- window сохраняет текущую политику: glass виден, но indoor Glow через него не
  проходит;
- virtual boundary к partition не относится;
- source внутри valid interior door/gate passage допустим; source внутри window
  tunnel или invalid/orphan cut fail-dark.

Barrier geometry получает joined partition body **после вычитания только его
hosted passages**. Cache fingerprint включает host id/t, partition endpoints/cm,
opening length/type и geometry validity. HA-only state tick не rebuild-ит barriers.

## 13. Sun semantics

Partition window не является exterior room-boundary window и не создаёт новый
sun wedge. Existing exterior windows и their wedges сохраняются. Если canonical
sun/physical clipping использует independent body set, hosted cut не должен
восстанавливать opaque partition поверх уже разрешённого passage; никаких новых
direction/source rules #132 не вводит.

## 14. HA state, actions и security

Contact/invert, lock, badges, open amount, info card, lock/unlock confirmation и
`resolveHaBindingStatus()` не зависят от host kind.

- Door/gate lock action остаётся единственной sanctioned opening surface.
- Marker tombstone не отключает exact opening entity reference.
- Disabled/orphaned/unverified entity не выполняет service call.
- Window не получает lock control, если current type contract его не допускает.
- Перемещение host не меняет entity ids и runtime state.

Новый action resolver или отдельный partition status model запрещён.

## 15. Move, edit, delete и Undo

### Move/edit

Rigid partition drag обновляет endpoints и materialized `x/y/angle` всех hosted
openings в одном preview/commit. `t`, length, entities and flips сохраняются.
Одна Undo/Redo command восстанавливает partition и все hosted projections.

Editor operation, которая сократила бы host меньше opening+jamb margin, блокирует
commit с причиной. Import/legacy invalid geometry не clamped молча.

### Delete

Если hosted openings нет, действует current delete path. Если есть:

1. dialog перечисляет openings в порядке `t`: локализованный type + length;
2. Cancel ничего не меняет;
3. Confirm атомарно удаляет partition и ровно его hosted openings;
4. одна Undo восстанавливает host и весь список с entities/geometry;
5. attachments отсутствуют у opening model, file cleanup не вызывается.

Удалять hosted openings без confirmation через generic cleanup запрещено.

## 16. Orphan и failure policy

Explicit partition opening с отсутствующим/invalid host:

- не вырезает physical body и не создаёт transparent light path;
- не рендерится как рабочий opening в View/kiosk/static/Iso;
- в Plan editor показывается диагностический orphan affordance в materialized
  `x/y`, позволяющий удалить или перепривязать объект;
- entity action из orphan affordance не выполняется;
- production console не спамится; diagnostic reason доступна test/support hook.

Boolean failure по одному cut возвращает непрорезанный opaque partition
(fail-dark), не удаляет config и не делает все independent bodies прозрачными.

## 17. Migration и compatibility

- Старые openings без `host` читаются и пишутся по current room-wall contract.
- Existing room-wall opening около partition не начинает прорезать partition.
- New optional fields добавляются в frontend/backend schema и
  `docs/CONFIG-COMPATIBILITY.md`/field registry.
- Export/import/backup сохраняют host object и referential order; counts остаются
  в общем числе openings.
- Align/optimize переносит partition и hosted opening согласованно, не re-snaps
  explicit host к nearby room wall.
- Older frontend may preserve unknown host fields, but backend referential
  validation prevents destructive orphan write; backward visual support не
  обещается до версии, реализующей #132.

Schema migration существующих данных не нужна: capability появляется только у
новых/явно перепривязанных openings.

## 18. i18n и accessibility

Новые en/ru strings:

- «Стена или перегородка» в placement guidance/error;
- host kind «Перегородка» в properties/diagnostic;
- confirmation title/body и строки списка hosted openings;
- orphan reason/rebind action, если affordance нужен по §16.

Opening dialog, list и confirmation используют существующий `hp-dialog`, focus
trap, Escape и restore focus. List доступен screen reader; confirmation сообщает
точное количество. Canvas preview не является единственным объяснением host:
properties/diagnostic имеет текстовое accessible name.

## 19. Acceptance criteria

1. **AC1 — placement.** Door/window/gate размещаются на partition canonical
   wall-bound workflow; draft/column/virtual span не принимаются.
   **Доказательство:** resolver unit + desktop browser smoke.
2. **AC2 — geometry.** Opening cut full-depth с корректными jamb/symbol для
   1/15/100 cm и diagonal partition, без прорезания coincident other body.
   **Доказательство:** geometry units + reviewed golden.
3. **AC3 — host lifecycle.** Rigid move переносит opening; delete показывает
   список и атомарно удаляет после Confirm; Undo/Redo восстанавливает всё.
   **Доказательство:** command units + browser smoke.
4. **AC4 — light.** Interior door/gate пропускают Glow через cut, exterior
   passage и window остаются opaque по current policy; failure fail-dark.
   **Доказательство:** light visibility units + smoke/golden.
5. **AC5 — render parity.** Plan/View/kiosk/static/Iso используют один resolved
   host и не расходятся по center/angle/depth/open state.
   **Доказательство:** cross-render smoke + golden.
6. **AC6 — HA/security parity.** Contact/lock/badge/actions совпадают с room-wall
   opening, secure/disabled guards не меняются. **Доказательство:** unit matrix + smoke.
7. **AC7 — compatibility.** Legacy openings unchanged; host fields survive
   save/export/import/optimize; invalid reference rejected or fail-dark.
   **Доказательство:** frontend/backend round-trip tests.
8. **AC8 — accessibility/touch safety.** Dialog/confirmation keyboard доступны,
   touch cancel/multi-touch не создают opening. **Доказательство:** browser smoke.
9. **AC9 — cache/performance.** HA tick не rebuild-ит structural geometry;
   cache bounded and invalidated by host geometry. **Доказательство:** counters +
   performance smoke.
10. **AC10 — no new type.** Config/UI допускает только door/window/gate.
    **Доказательство:** schema/source contract.

## 20. План автотестов

### Unit

- host serialization/resolution, t and reversed endpoints;
- room-wall vs partition candidate/tie/length fit;
- horizontal/vertical/diagonal, 1/15/100 cm cut and jambs;
- overlap reservation, junction patch, coincident independent body;
- move/delete/Undo atomic snapshots;
- interior/exterior/window light policy and fail-dark;
- orphan, missing host and cache fingerprint;
- HA state/action host-kind parity.

### Backend

- host discriminator/id/t and referential validation;
- config size/count limits, export/import/unknown fields;
- malformed/missing partition rejection;
- full HA harness authority — Linux CI/WSL.

### Browser smoke

- place/edit/drag door, window, gate on partition;
- host move, delete Cancel/Confirm and Undo/Redo;
- contact opens, lock confirmation/action, hide_openings;
- Glow across interior passage and blocked by window/exterior passage;
- Plan/View/kiosk/static/Iso parity;
- touch cancel/pinch safety and keyboard confirmation;
- import/optimize round trip.

### Golden

- thick/diagonal partition with all three types, light/dark;
- Glow before/after door passage and opaque window;
- hidden Iso panels/cuts and static-card parity;
- expected diffs accepted only from reviewed full Linux artifact.

### Performance

- cold structural build within current large-house budget;
- HA state tick geometry build count 0;
- repeated render cache growth 0/bounded caps;
- no per-opening repeated full wall index build.

## 21. Затронутые поверхности

- `OpeningCfg`, backend validation and config compatibility registry;
- opening placement/resolver, wall-thickness/physical geometry and command stack;
- Flat/static/Iso opening renderers;
- Glow/light and current sun physical consumers;
- Plan dialog/i18n, import/export/align/optimize;
- unit/backend/smoke/golden/performance fixtures;
- `docs/ARCHITECTURE.md`, `docs/CANVAS.md`, `docs/WALL-THICKNESS.md`,
  `docs/LIGHT.md`, `docs/SUN.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 22. Риски и откат

| Риск | Мера |
| --- | --- |
| Host inference режет не ту стену | explicit partition id+t |
| Junction union закрывает passage | cut-aware physical union tests |
| Delete теряет entities | atomic command snapshot + confirmation |
| Light проходит через window/outside | existing type/floor-side policy |
| Older writer оставляет orphan | backend referential validation |
| Geometry cost растёт per opening | single immutable host/index snapshot |

Откат запрещает создание новых partition-host openings и возвращает body union
after room cuts. Уже сохранённые host objects должны либо оставаться
read-preserved/diagnostic, либо требовать downgrade warning; автоматически
преобразовывать их в room-wall openings нельзя.

## 23. Release-артефакты

Implementation commit имеет `User-Visible: yes` и одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — placement/types/move/delete/light;
- `docs/ARCHITECTURE.md`, `docs/CANVAS.md`, `docs/WALL-THICKNESS.md`,
  `docs/LIGHT.md`, `docs/SUN.md`, `docs/CONFIG-COMPATIBILITY.md`;
- `docs/TESTING.md`.

Нужны reviewed Flat/Iso/Glow golden artifacts, targeted browser/performance
reports and exact Linux backend evidence. Visual baselines принимаются только
через `golden:accept -- --reviewed` по полному Linux artifact.

## 24. Принятые технические предположения

- partition host хранится explicit id+t, materialized x/y/angle сохраняются;
- room-wall openings остаются implicit для backward compatibility;
- ambiguous exact placement tie отклоняется вместо скрытого host выбора;
- partition window не становится exterior sun source;
- invalid host/cut fail-dark and hidden from ordinary View;
- точная форма discriminator fields может меняться на ревью без изменения
  persisted identity/lifecycle semantics.
