# Issue #132 — проёмы в независимых стенах

- **Issue:** https://github.com/Matysh/houseplan-card/issues/132
- **Связанный bug в том же scope:** https://github.com/Matysh/houseplan-card/issues/185
- **Статус документа:** актуализировано после #173 и #157; готово к ревью ТЗ
- **Приоритет:** P2
- **Тип:** feature, обычный трек
- **Пользовательское изменение:** да

## 1. Сценарий

Администратор рисует незамкнутую цепочку инструментом «Стены», завершает её
сменой инструмента, редактора или этажа и размещает в одном сохранённом сегменте
дверь, окно, ворота либо открытый проём тем же инструментом «Проём», которым
работает со стенами комнат. Домочадцы затем видят корректный разрыв, а для
stateful-типов — тот же live state и действия в View/kiosk.

## 2. Что человек увидит до и после

До изменения завершённая независимая стена остаётся сплошной и не принимает
проём; после изменения выбранный door/window/gate/passage вырезает её тело,
следует за конкретным host-сегментом и ведёт себя как тот же тип проёма в обычной
стене. При этом стена с проёмом по #185 остаётся полноценным ребром для
распознавания замкнутой комнаты.

## 3. Проблема и связь со scope

`partitions[]` — канонические независимые физические стены, но current opening
placement/index принимает только derived room walls. Physical union специально
добавляет partitions после opening cuts, поэтому проём не может вырезать их.

#173 заменил отдельный публичный инструмент «Перегородка» одной непрерывной
цепочкой «Стены». Активные сегменты crash-safe живут в `room_drafts`; явное
завершение превращает каждый сегмент в отдельный `partition` со stable `id`.
Face graph использует сохранённые partitions и может создать room wall на той же
оси, не удаляя исходный объект. Это делает composite room-wall/partition overlap
штатным, а не ошибочным случаем.

#185 фиксирует более новый продуктовый контракт: проём является свойством стены,
а не разрывом её структурного ребра. Поэтому opening cuts влияют на физическую и
световую геометрию, но room-face detection должен уметь замыкать область через
room wall или partition с любым поддержанным проёмом. `open_spans` остаются
реальным отсутствием стены и в topology не возвращаются.

Функция закрывает J4: администратор может без внешнего SVG точно воспроизвести
план. Правильный итоговый View также поддерживает J1/J2/J3: физическая геометрия,
contact/lock status и безопасные actions не расходятся с домом.

## 4. Решения владельца

1. На независимой стене разрешены все существующие типы: `door`, `window`,
   `gate`, `passage`. #132 не добавляет новый opening type.
2. Проём следует за host при движении перегородки.
3. Удаление перегородки с проёмами требует confirmation со списком и удаляет их
   только после явного согласия.
4. Contact, lock, badges и actions идентичны одноимённому проёму в room wall;
   меняется только host geometry.
5. Физический passage в перегородке участвует в световой геометрии по тем же
   type-specific правилам, что passage в стене.
6. При точном совпадении saved partition со стеной комнаты они считаются одним
   составным физическим барьером без дополнительного host chooser. Explicit host
   остаётся partition; hosted interval прорезает оба совпадающих тела. После
   движения partition вычисляемый room-wall cut исчезает, room config не
   переписывается.
7. По #185 проём любого поддержанного типа не разрывает структурное ребро для
   room-face detection. Контур через стену с проёмом замыкается, а проём и его
   host сохраняются.

## 5. Scope

- явная persisted host identity для partition opening;
- placement/hover/drag/edit/delete door, window, gate и passage на partition;
- full-depth cut, jamb/tunnel/symbol geometry с толщиной partition;
- composite cut совпадающих partition + derived room wall без persisted room
  provenance;
- движение/удаление host и единая Undo/Redo команда;
- structural wall axes для #185 отдельно от physical opening gaps; regression
  контракта #173 для endpoint/T/X/collinear faces и реальных `open_spans`;
- Flat Plan/View/kiosk/static и hidden Isometric renderers;
- clean floor, Glow barrier/source guard и действующие sun semantics;
- existing opening HA state/actions/security;
- backend validation, import/export/optimization compatibility;
- i18n, user/canonical docs, unit/backend/smoke/golden/performance evidence.

## 6. Не входит в задачу

- новый opening type или новая семантика существующего `passage`;
- проёмы в unfinished room drafts или columns;
- несколько host segments на один opening;
- автоматическая конверсия старого room-wall opening в partition opening;
- новый способ завершения Walls chain либо auto-resume finished partition;
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
- Один finished Walls segment создаёт один partition id. Бывшая multi-segment
  chain не становится составным host: соседние segments двигаются и удаляются
  независимо.
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
- derived room-wall intervals, collinear with and covering the hosted opening
  interval within the canonical wall epsilon;
- validity/orphan reason;
- adjacent floor samples/type-specific passage policy.

Placement preview, symbol, body/composite cut, tunnel, hit test, light barriers,
Iso panel, move/delete и tests используют этот resolver. Запрещён render-only
nearest-wall fallback для explicit partition host. Coincident room-wall coverage
— вычисляемая projection valid partition host, а не второй persisted host.

Если endpoints хоста представлены в обратном порядке при canonical rewrite,
rewrite одновременно заменяет `t → 1-t`, сохраняя physical center и hinge/flip
orientation. Простое rigid translation сохраняет `t`, length и flip.

## 9. Placement UX

Активный инструмент «Проём» рассматривает два host kind:

- solid derived room-wall intervals;
- saved independent partition segments.

Hover preview показывает тот же translucent door/window/gate и привязывается к
partition axis; `passage` использует свою действующую symbol-less preview. Center
квантуется по действующему wall-bound grid step, length целиком помещается между
endpoints. Click повторно разрешает candidate и открывает существующий opening
dialog.

При близких candidates выбирается минимальная perpendicular distance, затем
полное покрытие opening length. Точное collinear overlap room-wall/partition,
покрывающее reserved interval, считается одним composite barrier и выбирает
explicit partition host без дополнительного dialog. Не совпадающая геометрически
tie остаётся неразрешимой и отклоняется с локализованной причиной. Existing
opening hit имеет приоритет над placement.

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
- passage остаётся symbol-less full-depth cut по контракту #157;
- overlapping hosted openings не могут резервировать один interval дважды;
- junction patches после cut не должны заново закрыть passage.

Для zero/invalid thickness new partition невозможна по current validation
(1–100 cm). Malformed legacy host fail-dark: cut не применяется. Partition cut
выполняется по explicit host identity до единого physical union. Он дополнительно
вырезает только derived room-wall bodies, которые collinear и покрывают тот же
hosted interval в пределах canonical epsilon. Случайное пересечение, nearby
parallel wall или второй independent body не прорезаются.

## 11. Room topology и bug #185

Room-face graph получает два разных представления одной архитектуры:

- **physical/presentation:** opening interval вырезан из кладки и остаётся
  проходом для изображения, hit geometry и type-specific света;
- **structural room topology:** axis валидной стены непрерывен через
  door/window/gate/passage, потому что проём не отменяет принадлежность стены
  контуру комнаты.

`buildPlanSnapGeometry()` либо следующий pure collector обязан сохранить
structural room/partition segment через opening interval для face traversal, не
возвращая этот interval в physical body. Действующий opening cut может оставаться
snap boundary/measure input, но не удаляет connectivity для room detection.

Контракт применяется одинаково к legacy room-wall opening и новому
partition-hosted opening. Контур, который последним segment опирается на такую
стену endpoint/T/X/collinear-примыканием, предлагает room по обычному #173 flow;
opening config, host, entities и materialized geometry не мутируют. `open_spans`
и отсутствующий/invalid host остаются настоящими gaps. Пассивные HA state ticks,
редактирование opening state и render не запускают room dialog.

## 12. Floor fill и tunnel

Partition не является границей room ownership. После вычитания hosted opening
видна уже существующая clean-floor/fill geometry под body. Дополнительный
нейтральный paper tunnel не рисуется.

Если partition пересекает две room fills, каждый side сохраняет свою canonical
fill ownership; cut не смешивает alpha и не создаёт новую room. Glow/sun layers
остаются выше base fill. Opening symbol скрывается по `hide_openings`, но physical
cut, HA state и barrier semantics остаются активны, как у room-wall opening.

## 13. Glow и light barriers

Решение владельца «проём пропускает свет» реализуется через type-specific
существующий контракт:

- door/gate/passage — transparent passage только там, где по обе стороны host
  есть floor; `passage` не получает state или створку;
- exterior/no-floor с одной стороны остаётся opaque, чтобы Glow не уходил наружу;
- window сохраняет текущую политику: glass виден, но indoor Glow через него не
  проходит;
- virtual boundary к partition не относится;
- source внутри valid interior door/gate/passage допустим; source внутри window
  tunnel или invalid/orphan cut fail-dark.

Barrier geometry получает joined partition body **после вычитания только его
hosted passages**. Cache fingerprint включает host id/t, partition endpoints/cm,
opening length/type и geometry validity. HA-only state tick не rebuild-ит barriers.

## 14. Sun semantics

Partition window не является exterior room-boundary window и не создаёт новый
sun wedge. Existing exterior windows и their wedges сохраняются. Если canonical
sun/physical clipping использует independent body set, hosted cut не должен
восстанавливать opaque partition поверх уже разрешённого passage; никаких новых
direction/source rules #132 не вводит.

## 15. HA state, actions и security

Contact/invert, lock, badges, open amount, info card, lock/unlock confirmation и
`resolveHaBindingStatus()` не зависят от host kind.

- Door/gate lock action остаётся единственной sanctioned opening surface.
- Marker tombstone не отключает exact opening entity reference.
- Disabled/orphaned/unverified entity не выполняет service call.
- Window не получает lock control, если current type contract его не допускает.
- Passage остаётся inert: без contact/lock/invert/flip, badge, info card и service
  call, по тому же контракту #157 на room wall.
- Перемещение host не меняет entity ids и runtime state.

Новый action resolver или отдельный partition status model запрещён.

## 16. Move, edit, delete и Undo

### Move/edit

Rigid drag одного partition segment обновляет endpoints и materialized
`x/y/angle` всех его hosted openings в одном preview/commit. `t`, length,
entities and flips сохраняются. Соседние segments бывшей Walls chain не
двигаются. Одна Undo/Redo command восстанавливает partition и все hosted
projections, включая computed composite cut.

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

## 17. Orphan и failure policy

Explicit partition opening с отсутствующим/invalid host:

- не вырезает physical body и не создаёт transparent light path;
- не рендерится как рабочий opening в View/kiosk/static/Iso;
- в Plan editor показывается диагностический orphan affordance в materialized
  `x/y`, позволяющий удалить или перепривязать объект;
- entity action из orphan affordance не выполняется;
- production console не спамится; diagnostic reason доступна test/support hook.

Boolean failure по одному cut возвращает непрорезанный opaque partition
(fail-dark), не удаляет config и не делает все independent bodies прозрачными.

## 18. Migration и compatibility

- Старые openings без `host` читаются и пишутся по current room-wall contract.
- Existing room-wall opening около partition не начинает прорезать partition.
- Room-wall opening, существовавший до #132, сохраняет implicit host и участвует
  в structural room topology по #185 без migration/write-on-read.
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

## 19. i18n и accessibility

Новые en/ru strings:

- «Стена или перегородка» в placement guidance/error;
- host kind «Перегородка» в properties/diagnostic;
- confirmation title/body и строки списка hosted openings;
- orphan reason/rebind action, если affordance нужен по §17.

Opening dialog, list и confirmation используют существующий `hp-dialog`, focus
trap, Escape и restore focus. List доступен screen reader; confirmation сообщает
точное количество. Canvas preview не является единственным объяснением host:
properties/diagnostic имеет текстовое accessible name.

## 20. Acceptance criteria

1. **AC1 — Walls workflow и placement.** После завершения multi-segment цепочки
   «Стены» каждый saved segment является отдельным candidate host. На partition
   размещаются door/window/gate/passage; active draft, column и virtual span не
   принимаются. **Доказательство:** resolver/lifecycle unit + desktop smoke.
2. **AC2 — geometry и composite overlap.** Opening cut full-depth с корректными
   jamb/symbol для 1/15/100 cm и diagonal partition. При точном покрывающем
   room-wall overlap partition выбирается explicit host и весь composite barrier
   прорезается; crossing/nearby/второй independent body не затрагиваются.
   **Доказательство:** geometry units + reviewed golden.
3. **AC3 — host lifecycle.** Rigid move одного segment переносит его openings и
   убирает computed room-wall cut; delete показывает точный список и атомарно
   удаляет после Confirm; Undo/Redo восстанавливает host/openings/composite.
   **Доказательство:** command units + browser smoke.
4. **AC4 — light.** Interior door/gate/passage пропускают Glow через полный
   composite cut; exterior/no-floor варианты и window остаются opaque по current
   policy; invalid host/boolean failure fail-dark. **Доказательство:** light
   visibility units + smoke/golden.
5. **AC5 — #185 room closure.** Room-face detection считает wall axis
   непрерывным через door/window/gate/passage как на legacy room wall, так и на
   partition host. Endpoint/T/X/collinear closure предлагает room и сохраняет
   opening bit-equivalent; `open_span` остаётся gap. **Доказательство:** pure
   topology unit + production-bundle smoke, который краснеет на `origin/dev`.
6. **AC6 — no passive topology mutation.** HA state, opening edit/render,
   reload и existing closed face не показывают room dialog и не меняют geometry;
   только последний accepted Walls segment может инициировать предложение по
   #173. **Доказательство:** wall-face graph unit + smoke.
7. **AC7 — render parity.** Plan/View/kiosk/static/Iso используют один resolved
   host и не расходятся по center/angle/depth/open state; passage остаётся
   symbol-less. **Доказательство:** cross-render smoke + golden.
8. **AC8 — HA/security parity.** Door/window/gate contact/lock/badge/actions
   совпадают с room-wall contract, secure/disabled guards не меняются; passage
   остаётся inert. **Доказательство:** unit matrix + smoke.
9. **AC9 — compatibility.** Legacy openings unchanged; host fields survive
   save/export/import/optimize; invalid reference rejected or fail-dark; schema
   принимает ровно четыре уже существующих type. **Доказательство:**
   frontend/backend round-trip tests.
10. **AC10 — accessibility/touch safety.** Dialog/confirmation keyboard
    доступны, touch cancel/multi-touch не создают opening и не завершают Walls
    chain. **Доказательство:** browser smoke.
11. **AC11 — cache/performance.** HA tick и pointermove не rebuild-ят host,
    composite или face topology; caches bounded и инвалидируются geometry host /
    opening type/length. **Доказательство:** counters + performance smoke.
12. **AC12 — regression #173/#157.** Walls finish/no-auto-resume, room queue,
    passage field restrictions, room-wall opening placement и планы без hosted
    openings остаются совместимыми. **Доказательство:** existing targeted suites
    + named #132 smoke.

## 21. План автотестов

### Unit

- host serialization/resolution, t and reversed endpoints;
- room-wall vs partition candidate, composite/non-composite tie and length fit;
- horizontal/vertical/diagonal, 1/15/100 cm cut and jambs;
- overlap reservation, junction patch, coincident derived wall vs independent body;
- move/delete/Undo atomic snapshots;
- interior/exterior/window/passage light policy and fail-dark;
- structural-vs-physical collector: all four openings preserve room-face axes,
  while `open_span` remains a gap; endpoint/T/X/collinear #185 matrix;
- only the latest accepted segment may cause room proposal; opening/HA updates do not;
- orphan, missing host and cache fingerprint;
- HA state/action host-kind parity.

### Backend

- host discriminator/id/t and referential validation;
- config size/count limits, export/import/unknown fields;
- canonical `passage` field restrictions from #157 with partition host present;
- malformed/missing partition rejection;
- full HA harness authority — Linux CI/WSL.

### Browser smoke

- finish multi-segment Walls chain; place/edit/drag door, window, gate and passage
  on one resulting partition without resuming the chain;
- host move, delete Cancel/Confirm and Undo/Redo;
- contact opens, lock confirmation/action, hide_openings;
- Glow across interior passage and blocked by window/exterior passage;
- reproduce #185 on legacy room wall and hosted partition for all four types,
  including T closure; verify `open_span` still blocks closure and opening config
  is unchanged;
- exact composite overlap selects partition host without an extra chooser and
  leaves no opaque wall layer across the opening;
- Plan/View/kiosk/static/Iso parity;
- touch cancel/pinch safety and keyboard confirmation;
- import/optimize round trip.

### Golden

- thick/diagonal partition with all four types, light/dark;
- coincident room-wall/partition composite before and after hosted cut;
- Glow before/after door passage and opaque window;
- hidden Iso panels/cuts and static-card parity;
- expected diffs accepted only from reviewed full Linux artifact.

### Performance

- cold structural build within current large-house budget;
- HA state tick geometry build count 0;
- repeated render cache growth 0/bounded caps;
- no per-opening repeated full wall index build.

## 22. Затронутые поверхности

- `OpeningCfg`, backend validation and config compatibility registry;
- opening placement/resolver, wall-thickness/physical geometry and command stack;
- `plan-snap-overlay`/wall-face structural collector and #173 room queue;
- Flat/static/Iso opening renderers;
- Glow/light and current sun physical consumers;
- Plan dialog/i18n, import/export/align/optimize;
- unit/backend/smoke/golden/performance fixtures;
- `docs/ARCHITECTURE.md`, `docs/CANVAS.md`, `docs/UX-MODES.md`,
  `docs/WALL-THICKNESS.md`, `docs/LIGHT.md`, `docs/SUN.md`,
  `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 23. Риски и откат

| Риск | Мера |
| --- | --- |
| Host inference режет не ту стену | explicit partition id+t |
| Composite overlap режет nearby/crossing body | collinear full-interval coverage + negative units |
| Junction union закрывает passage | cut-aware physical union tests |
| #185 возвращает физическую кладку в проём | отдельные structural и physical projections |
| Opening начинает пассивно открывать room dialog | topology-delta и no-passive smoke #173 |
| Delete теряет entities | atomic command snapshot + confirmation |
| Light проходит через window/outside | existing type/floor-side policy |
| Older writer оставляет orphan | backend referential validation |
| Geometry cost растёт per opening | single immutable host/index snapshot |

Откат запрещает создание новых partition-host openings и возвращает body union
after room cuts. Уже сохранённые host objects должны либо оставаться
read-preserved/diagnostic, либо требовать downgrade warning; автоматически
преобразовывать их в room-wall openings нельзя.

## 24. Release-артефакты

Implementation commit имеет `User-Visible: yes` и одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — Walls finish, placement/types/move/delete/light и
  closure через стену с проёмом;
- `docs/ARCHITECTURE.md`, `docs/CANVAS.md`, `docs/UX-MODES.md`,
  `docs/WALL-THICKNESS.md`, `docs/LIGHT.md`, `docs/SUN.md`,
  `docs/CONFIG-COMPATIBILITY.md`;
- `docs/TESTING.md`.

Нужны reviewed Flat/Iso/Glow golden artifacts, targeted browser/performance
reports and exact Linux backend evidence. Visual baselines принимаются только
через `golden:accept -- --reviewed` по полному Linux artifact.

## 25. Принятые технические предположения

- partition host хранится explicit id+t, materialized x/y/angle сохраняются;
- room-wall openings остаются implicit для backward compatibility;
- exact covering room-wall/partition overlap выбирает partition host как
  owner-approved composite; прочие ambiguous ties отклоняются;
- structural room topology may use uncut wall axes, while all physical/light
  consumers continue using type-specific cuts; shared persisted geometry не
  создаётся;
- partition window не становится exterior sun source;
- invalid host/cut fail-dark and hidden from ordinary View;
- точная форма discriminator fields может меняться на ревью без изменения
  persisted identity/lifecycle semantics.
