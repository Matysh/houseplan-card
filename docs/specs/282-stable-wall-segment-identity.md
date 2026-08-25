# Issue #282 — стабильная идентичность сегментов стен (ADR Stage 1)

- **Issue:** https://github.com/Matysh/houseplan-card/issues/282
- **ADR:** [`docs/adr/282-wall-geometry-representation.md`](../adr/282-wall-geometry-representation.md)
- **Статус:** принято независимым ревью; Stage 1 реализован и проверен
- **Тип / приоритет:** tech-debt / P1
- **Поставляемый этап:** Stage 1 — stored identity
- **Целевая версия модели:** `PLAN_MODEL_VERSION = 8`
- **Пользовательское изменение:** да, но без нового интерфейса

## 1. Сценарий

**Персона:** администратор дома из `docs/SCOPE.md`, который уже построил план и
поддерживает его в Plan editor на desktop. **Момент:** Resize, Split, Merge,
изменение толщины, размещение проёма, импорт либо Optimize меняют геометрию
существующего плана. View, kiosk и touch-потребители затем должны увидеть тот же
дом без пропавшей толщины, переехавшего проёма или нового шва.

Задача обслуживает J6: «Keep the plan true as the home evolves». Это не новая
возможность рисования, а устранение причины, по которой уже сохранённая стена
теряет смысл после дальнейшего редактирования.

## 2. Что человек увидит до и после

**До:** после сложного изменения внешне та же стена иногда теряет толщину,
получает толщину соседнего участка либо отделяется от своего проёма. **После:**
та же операция сохраняет принадлежность толщины и проёмов стене; внешний вид и
состав кнопок не меняются.

Единственное новое видимое состояние — честный отказ от структурной записи,
если старый план невозможно преобразовать без потери данных. View продолжает
работать по compatibility reader; диалог/тост называет причину, предлагает
сначала запустить «Оптимизировать планы», а при повторном отказе — исправить
конфликтующую геометрию стен.

## 3. Проблема и подтверждённая причина

Сегодня contour wall одновременно является:

1. ребром `rooms[].poly`;
2. разреженной записью толщины `space.walls[]`, найденной по вычисленному
   `wallKey` (квантованные midpoint + angle);
3. пространственно найденным носителем room opening без сохранённой ссылки.

Геометрическая операция обязана заново вывести все три связи. Пропущенный или
слегка отличающийся re-key теряет толщину (#253/#258); частичное совпадение
создаёт неоднозначную роль (#299); Split/Resize вынуждены материализовать и
переименовывать атомы до изменения контура. Канонизация координат #291 убрала
битовый noise, но не устранила вывод идентичности из изменяемой геометрии.

Independent `partitions[]` уже имеют стабильный `id`, а hosted openings уже
ссылаются на него. Stage 1 переносит этот доказанный принцип на contour walls и
на незавершённые draft segments. Renderer и вычисление junction geometry пока
не переписываются: они получают compatibility projection из новой модели.

## 4. Скоуп

В задачу входят:

- стабильный persisted `id` каждого атомарного contour segment;
- ссылки комнат на эти ID в порядке обхода контура;
- толщина на самом segment record, включая отсутствие физического тела;
- стабильные ID draft segments; существующие partition IDs сохраняются;
- wall-host для door/window/gate/passage на contour segment;
- детерминированная v7 → v8 миграция и runtime-проекция без записи на read;
- единый identity writer/barrier для Resize, Split, Merge, Delete, draw/close,
  thickness, opening placement, Optimize, Undo/recovery и import/export;
- compatibility projection `rooms[].poly`, `walls[]`, legacy unhosted openings;
- backend validation, limits, import remap и fail-closed stale-client policy;
- unit/backend/invariant/mutation/smoke/golden/performance evidence;
- обновление канонической документации и обоих changelog.

## 5. Не-скоуп

- integer node indices и новый `STORAGE_VERSION` (ADR Stage 2);
- отказ от `rooms[].poly` как compatibility projection (Stage 3);
- единый persisted planar graph для room walls и partitions (Stage 3);
- closed-form junction renderer и удаление polygon booleans (Stage 4);
- новый UI, изменение жестов, новые инструменты или иная геометрия результата;
- исправление видимого дефекта конкретного junction, не вызванного identity;
- индивидуальная настройка ID либо их показ пользователю;
- автоматическое притягивание authored off-grid geometry;
- удаление legacy reader в этом релизе.

Stages 2–4 требуют отдельных issues и поставляются независимо. Закрытие #282
после Stage 1 означает завершение текущего исполнимого этапа ADR, а не отмену
оставшегося направления.

## 6. Целевая persisted-модель

### 6.1 Contour segments

В пространство добавляется полный каталог атомарных contour walls:

```ts
interface StoredWallSegment {
  id: string;        // stable, unique inside one space
  a: [number, number];
  b: [number, number];
  cm: number;        // 0..100; 0 = axis without a physical body
}

interface RoomCfg {
  poly: number[][];  // required compatibility projection in v8
  wall_ids: string[]; // one id for every consecutive poly edge
}

interface SpaceCfg {
  wall_segments: StoredWallSegment[];
  walls?: LegacyWallEntry[]; // generated compatibility projection
}
```

`wall_segments[]` содержит **каждый** атом contour, а не только участок с
положительной толщиной. В v8 `wall_segments[].id/a/b/cm` и
`rooms[].wall_ids[]` являются authoritative для identity и толщины.

`rooms[].poly` остаётся authoritative для формы комнаты до ADR Stage 3, но в
v8 его стороны и `wall_ids` обязаны образовывать exact согласованную пару:

- `wall_ids.length === poly.length`;
- segment с соответствующим ID совпадает с ребром `poly[i] → poly[i+1]` в
  прямом либо обратном направлении;
- один ID может ссылаться из одной комнаты (`outer`) или двух комнат (`shared`);
- ссылка из трёх и более комнат, orphan segment либо дублированный ID невалидны;
- shared segment обязан иметь одни exact endpoints и один `cm` для владельцев.

Если общий участок занимает только часть длинной стороны комнаты, миграция
добавляет коллинеарные vertices и делит сторону на атомы. Площадь, winding,
silhouette и видимый SVG при этом не меняются.

### 6.2 Толщина 0

`cm: 0` в catalog означает действующее сегодняшнее состояние «контур есть,
физического wall body нет». Это техническое представление полной модели, а не
пользовательская возможность issue #306:

- Plan UI в #282 по-прежнему предлагает прежний диапазон и инструменты;
- legacy sparse interval без `walls[]` мигрирует в segment `cm: 0`;
- virtual/open boundary продолжает определяться `open_spans/open_to`, а не
  одним `cm: 0`;
- body/area/opening/light semantics остаются byte/geometry-equivalent v7.

Разрешение пользователю рисовать zero-thickness walls и отказ от virtual walls
остаются в приостановленном #306 и не входят скрытым изменением сюда.

### 6.3 Independent walls и drafts

`partitions[].id` уже является стабильной identity и не мигрирует в новый
catalog до Stage 3. Его endpoints/cm остаются на partition record.

Каждая `room_drafts[].segments[]` получает `id`:

```ts
segments: Array<{ id: string; cm: number }>
```

ID сохраняется при продолжении/перемещении draft. При превращении draft в
partition либо contour соответствующий segment наследует ID, если его carrier
не был разделён. При split действуют lineage-правила §8.

### 6.4 Openings

Host становится tagged union:

```ts
type OpeningHost =
  | { kind: 'partition'; id: string; t: number }
  | { kind: 'wall'; id: string; t: number };
```

Новые room openings всегда сохраняют wall host. `t` направлен от stored `a` к
`b`; визуальный flip/створка от направления segment не зависят. Legacy opening
без host остаётся читаемым и получает runtime host spatial resolver. На первой
структурной записи host материализуется только при единственном доказанном
carrier; неоднозначность блокирует миграцию, а не выбирает ближайший наугад.

### 6.5 Compatibility projection `walls[]`

`walls[]` временно остаётся persisted projection для старых клиентов и
неизменённого renderer:

- генерируется централизованно из `wall_segments` (положительные `cm`, exact
  `a/b`, вычисленный compatibility `key`);
- не является source of truth в v8;
- v8 backend проверяет его semantic parity с catalog, но key drift сам по себе
  не делает catalog невалидным;
- новый frontend никогда не присваивает `walls[]` напрямую;
- runtime geometry получает прежний `WallEntry[]` через один adapter;
- в v7 отсутствие catalog сохраняет нынешний reader без записи.

Re-key остаётся только деталью compatibility serializer. Ни Resize, ни Split,
ни business logic не используют key как identity после v8 migration.

## 7. Атомизация и deterministic migration v7 → v8

### 7.1 Breakpoints

До вычисления breakpoint в том же local candidate и до любых v8 ID/ref
запускается существующий write-barrier #291 `canonicalizeConfigGeometry`.
Порог и правило принадлежат только ему: текущий `LATTICE_NOISE_STEPS = 1e-4`
шага сетки. Все слова `exact` ниже означают побитовое равенство **уже
канонизированных** координат; дополнительный wall-thickness epsilon и третий
допуск Stage 1 не вводит. Если канонизация или последующая атомизация
отклоняет candidate, исходный v7 document остаётся byte-equivalent.

Каждая room boundary разбивается в точках:

- vertices всех room polygons;
- начала/концы коллинеарного overlap другой комнаты;
- exact `walls[].a/b` и доказанные границы key-only legacy record;
- `open_spans` и доказанные shared `open_to` spans;
- пересечения с structural nodes, уже используемые текущим wall profile.

Opening edges не делят segment сами по себе: opening хранит `t` и ширину.
Нулевая длина, self-overlap, конфликтующие positive thickness records либо
неоднозначный key-only carrier блокируют миграцию всего пространства.

### 7.2 Толщина

Для каждого атома выбирается ровно действующий v7 resolver:

1. exact matching `walls[].a/b`;
2. exact covering record;
3. legacy key/midpoint fallback;
4. отсутствие записи → `cm: 0`.

Разные positive candidates на одном атоме — blocker, не `min/max/last wins`.
Open boundary не удаляет segment и не меняет `cm`; light/body projection
применяет open cut отдельно, как до миграции.

### 7.3 ID migration

Первоначальный ID детерминирован для повторяемой миграции одного v7 document:

```text
wall-<base32(sha256(space-id | canonical-a | canonical-b | sorted-owner-ids))[0:20]>
```

Endpoint order не влияет на hash. Collision после усечения разрешается
детерминированным `-2`, `-3` после сортировки полной digest; collision полного
digest либо duplicate resulting ID блокирует миграцию.

Это **только seed миграции**. После сохранения ID никогда не вычисляется заново
из geometry. Новые IDs создаёт один monotonic/random id factory с проверкой
уникальности в space; импорт использует общий bounded remapper.

### 7.4 Момент миграции

Read-only загрузка v7 не пишет Store и не повышает model version. Runtime строит
immutable projected catalog для View и editor selection.

Атомарная v8 materialization выполняется:

- перед первой успешной structural config mutation пространства;
- явным Optimize plans;
- при добавлении v7 space в уже v8 config;
- при full/space import candidate, если target требует v8.

Изменение только настроек устройства/пространства, layout marker position или
View state не мигрирует wall model. Успешная materialization записывает catalog,
room refs, hosted openings, compatibility projection и `model_version: 8` одной
config transaction/Undo command. Ошибка оставляет candidate byte-equivalent.

## 8. Identity lineage при операциях

ID сохраняется, когда физический/топологический carrier остаётся тем же объектом,
даже если изменились endpoints, angle, length, owner или compatibility key.

### 8.1 Move и Resize

- whole segment, перенесённый/растянутый одной доказанной операцией, сохраняет ID;
- shared segment, одинаково преобразованный обоими owners, остаётся одним ID;
- несовместимые transforms owners отклоняются preflight;
- изменение только endpoints никогда не создаёт новый ID.

### 8.2 Split одного segment

При появлении breakpoint исходный ID получает ровно один child:

1. child, содержащий старый midpoint внутри;
2. при midpoint на новой границе — child, содержащий canonical old `a`;
3. остальные children получают новые IDs в геометрическом порядке от old `a`.

Openings rehost по их physical centre/interval и получают пересчитанный `t`.
Opening, пересекающий новую границу между children с разными условиями,
блокирует операцию до записи.

### 8.3 Merge segments

Слияние разрешено только для коллинеарных соседей с одинаковыми `cm`, owner set,
open-boundary role и без semantic breakpoint. Survivor ID выбирается:

1. segment с большим количеством существующих opening hosts;
2. затем самый длинный;
3. затем лексикографически меньший ID.

Все refs/hosts переводятся на survivor с пересчитанным `t`. Остальные IDs
исчезают; tombstone не хранится, поскольку Undo содержит полный snapshot.

### 8.4 Split/Merge/Delete rooms

- смена outer ↔ shared сама по себе ID не меняет;
- segment, остающийся на границе хотя бы одной surviving room, сохраняется;
- полностью удалённый carrier удаляется только в уже подтверждённом user flow;
- Keep walls переводит contour segment в partition с тем же ID, если ID не
  конфликтует с существующим partition;
- обратное включение unambiguous partition в contour сохраняет ID.

### 8.5 Draft close/cancel

Сохранённый draft segment сохраняет ID между сессиями. Незавершённый in-memory
rubber band ID не получает. Cancel не расходует persisted ID. Закрытие room
переносит IDs; atomization применяет §8.2.

### 8.6 Undo/Redo и concurrency

Undo/Redo восстанавливает exact snapshots с теми же IDs. Config revision guard
проверяется до lineage calculation и ещё раз при commit; stale revision не
может частично сохранить catalog. Concurrent edit получает обычный conflict и
перезагружает authoritative snapshot.

## 9. Writers и единый identity barrier

Новый pure-модуль (рабочее имя `src/wall-segment-model.ts`) владеет:

- v7 projection/migration;
- validation/parity;
- compatibility `walls[]` projection;
- ID lineage split/merge/rehost;
- persisted/runtime fingerprints.

Каждая structural mutation работает над local candidate, сначала пропускает
его через `canonicalizeConfigGeometry` #291, затем через
`commitWallSegmentModel(candidate)` и только после этого достигает
`_commitPhysicalGeometry`/backend write. Канонизация и identity migration входят
в одну атомарную commit-транзакцию; результат первой является единственным
координатным input второй.
Source guard перечисляет все structural writer entrances и падает, если новый
путь записывает `rooms.poly`, `walls`, `wall_segments`, `partitions`, drafts или
architectural openings мимо barrier.

Запрещено исправлять задачу добавлением ID assignments в десятки обработчиков.
Локальные контроллеры могут передать lineage hint, но один barrier доказывает и
пересобирает согласованную модель.

Backend mirror проверяет:

- schema bounds/unique IDs/references;
- geometry/ref/parity invariants;
- v8 catalog ↔ compatibility projection;
- wall/partition opening host and `t` fit;
- отсутствие direct Store writer bypass.

Backend не придумывает lineage для валидного v8 candidate; он либо принимает
его целиком, либо отклоняет.

## 10. Старые клиенты и совместимость

### 10.1 v7 data на новом клиенте

View/read работает через runtime projection. Первая structural write предлагает
тот же operation вместе с migration; успех атомарный. Export до migration
сохраняет фактический v7 document, не штампует v8.

### 10.2 v8 data на старом клиенте

Старый клиент может сохранить неизвестные поля, но не способен согласованно
обновить refs/catalog. Backend обнаруживает изменение structural projection без
соответствующего v8 catalog и отклоняет весь config write кодом
`wall_model_client_outdated`. UI нового клиента локализует его как требование
обновить/перезагрузить карточку. View/read старого клиента может использовать
compatibility `poly/walls`; безопасное редактирование старым клиентом не
обещается.

### 10.3 Import/export/duplicate

- full replace v8 сохраняет IDs после полной validation;
- space import и duplicate remap every wall/draft/partition ID and all
  `wall_ids`/opening hosts одним lineage table;
- collision с target никогда не resolve-ится геометрическим совпадением;
- v7 import в v7 target сохраняется v7; в v8 target материализуется до merge;
- plan-only export/import включает catalog/refs/hosts и не оставляет dangling IDs;
- future unknown fields сохраняются на record/room/space как сейчас;
- future model version отклоняется до migration.

### 10.4 Configuration lifecycle

`wall_segments`, `rooms[].wall_ids`, `room_drafts[].segments[].id` и wall host
регистрируются в `scripts/config-field-registry.mjs` как current v8. `walls.key`
и unhosted room openings получают documented compatibility statuses, но reader
удаляется только отдельной задачей после окна поддержки.

## 11. UX, accessibility, touch и security

- кнопки, поля, значения толщины и pointer gestures не меняются;
- View/kiosk output и actions не меняются;
- hover/hit-test/selection используют ID internally, но показывают прежние ink;
- editor остаётся desktop-first; touch View acceptance блокирующий;
- screen reader/keyboard contract не расширяется;
- ID никогда не показываются в обычном UI и не попадают в toast/telemetry;
- новые HA service calls, URL/HTML или permission boundaries отсутствуют;
- failure UI не раскрывает geometry/config data, только локализованный класс
  blocker и действие пользователя.

## 12. i18n

Новые RU/EN ключи (точное имя можно привести к namespace проекта):

| Key | RU | EN |
|---|---|---|
| `toast.wall_model_migration_blocked` | `Не удалось обновить модель стен: {reason}. План не изменён. Запустите «Оптимизировать планы»; если ошибка повторится, исправьте конфликтующую геометрию стен.` | `The wall model could not be updated: {reason}. The plan was not changed. Run “Optimize plans”; if the error repeats, fix the conflicting wall geometry.` |
| `toast.wall_model_client_outdated` | `Обновите карточку и перезагрузите страницу перед редактированием плана.` | `Update the card and reload the page before editing the plan.` |
| `gs.wall_segments_migrated` | `Стабилизировано сегментов стен: {n}.` | `Wall segments stabilised: {n}.` |

Reason names проходят через bounded enum и отдельные localized labels; raw IDs,
exception text и config values не интерполируются.

## 13. Лимиты и производительность

- catalog ограничен суммой допустимых room polygon sides после atomization;
  hard backend cap — `MAX_ROOMS × MAX_POLY_POINTS` (текущие 200 000), а общий
  import/export byte cap остаётся более строгим практическим ограничением;
- duplicate IDs, refs и parity проверяются O(V + E) через maps;
- spatial atomization migration допускает O(E log E), но не O(E²) на обычном
  payload; shared-axis grouping обязано иметь spatial/axis index;
- read/render tick не мигрирует и не хэширует полный config повторно;
- runtime projection и catalog fingerprint кэшируются по config revision;
- large-house structural render p95 и editor commit p95 не регрессируют более
  чем на 20% same-run baseline;
- migration 10 000 contour atoms укладывается в 500 ms p95 в Node benchmark и
  не создаёт второго полного deep clone сверх transaction snapshot;
- новые limits не отклоняют ни один валидный v7 fixture до попытки migration.

## 14. Критерии приёмки

### AC1. Детерминированная lossless migration

v7 fixtures с outer/shared/partial-overlap/T/X/diagonal/open span/key-only,
exact walls и lattice-noise по обе стороны порога #291 дважды дают
byte-equivalent v8 candidate. Шум внутри порога сначала канонизируется и не
создаёт micro-segments; координата вне порога не схлопывается молча. Polygon
area, winding, wall-body path, clean floor, opening projection, Glow/sun
barriers и isometric geometry до/после равны по существующим строгим/golden
контрактам.

**Доказательство:** TS migration unit matrix + golden/static path comparison +
backend fixture parity.

### AC2. Полный и валидный catalog

Для каждого v8 space все contour atoms имеют unique stable ID; каждая poly side
имеет ровно один wall ref; owner count 1/2; orphan/dangling/duplicate/third-owner,
zero-length и conflicting thickness отклоняются. Positive legacy thickness и
thin contour сохраняют прежний вид.

**Доказательство:** frontend/backend shared valid+invalid JSON fixture.

### AC3. Identity не зависит от geometry после migration

Move/Resize/angle/length/key change whole segment сохраняют ID. Мутант,
перевычисляющий ID из endpoints после каждого commit, убивается тестом.

**Доказательство:** pure lineage tests + Resize browser smoke.

### AC4. Split/merge lineage

Split выбирает survivor по midpoint/old-a; merge — по hosts/length/id. Room refs
и hosted opening `t` обновляются атомарно. Повторение операции после Undo/Redo
возвращает exact те же IDs.

**Доказательство:** parameterized unit tests для directions/ties/openings +
Split/Merge smoke.

### AC5. Все structural operations проходят barrier

Draw/close, wall thickness, opening placement/move/delete, Resize, Split, Merge,
room Delete/Keep walls, partition conversion, Optimize, Undo/Redo/recovery и
import вызывают один identity barrier. Direct assignments не могут попасть в
persisted write.

**Доказательство:** executable source/AST guard + bypass mutant для каждого
writer family.

### AC6. Room openings hosted

Новый room opening всегда имеет `{kind:'wall', id, t}`. Legacy unique carrier
материализуется; ambiguous/missing/intersecting split блокирует transaction.
Door/window/gate/passage, flip, contact/lock и Glow tunnel не меняются.

**Доказательство:** opening unit matrix + `smoke_opening_measure`/targeted host
smoke + backend schema tests.

### AC7. Compatibility projection

v8 → legacy `poly/walls/unhosted visual input` projection даёт текущим full,
static, hidden-isometric и light consumers прежние inputs. Runtime code не ищет
business identity через `wallKey`; key генерирует только adapter/compat layer.

**Доказательство:** source guard + projection snapshots + existing geometry
suite.

### AC8. Read-only и атомарный failure

Открытие v7 config, View, kiosk, navigation и device/layout-only save не пишут
catalog/model version. Structural migration blocker оставляет config/layout/rev
byte-equivalent и сохраняет работающий View.

**Доказательство:** store call-count tests + failure fixture + browser smoke.

### AC9. Старый клиент fail-closed

Попытка изменить v8 `poly/walls/openings` без согласованного catalog отклоняется
bounded error; ни один partial Store write не происходит. Byte-equivalent
round-trip старого клиента принимается.

**Доказательство:** backend old-client write tests.

### AC10. Import/export и ID remap

Full/space/plan-only export-import, duplicate and backup restore сохраняют либо
полностью remap-ят ID/ref/host graph. Collision, dangling ref и future model
отклоняются до apply; preview counts согласованы с candidate.

**Доказательство:** HA import/export harness + shared lineage fixture.

### AC11. Limits и unknown fields

Boundary cases catalog/draft IDs/refs проходят или fail atomically. Unknown
sibling fields на config/space/room/segment/opening survive migration and
round-trip. Atomization не truncates data ради лимита.

**Доказательство:** backend validation/property tests.

### AC12. Geometry regression floor

Все тесты #197/#224/#249/#253/#258/#261/#271–#280/#288–#302 остаются зелёными.
Точный ID не является поводом удалить существующую union isolation либо
ослабить geometry preflight.

**Доказательство:** `npm test`, model invariants, named wall smokes/goldens.

### AC13. View/touch parity

Desktop View, kiosk и phone/touch fixture визуально равны pre-migration baseline;
room/device/opening taps и pinch не получают editor behaviour.

**Доказательство:** targeted Playwright view/touch smoke + golden comparison.

### AC14. Performance

Выполнены budgets §13; migration не запускается на render/live HA tick.

**Доказательство:** same-run benchmark с machine-readable result.

### AC15. Optimize UX

Optimize preview отдельно сообщает количество materialized segment IDs. Cancel
— zero writes; Confirm — одна config transaction и одна Undo; второй run no-op.

**Доказательство:** optimizer unit test + targeted dialog smoke.

### AC16. Документация и compatibility registry

Обновлены `WALL-THICKNESS.md`, `ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`,
`CANVAS.md`, user guides RU/EN, `TESTING.md`, ADR status и config-field registry.
Термины ID/catalog не попадают в пользовательскую инструкцию кроме объяснения
автоматического обновления старого плана.

**Доказательство:** docs/config audit gates.

### AC17. Gates

Перед code review зелёные:

- `npm run typecheck`;
- `npm test`;
- `npm run build` + `npm run bundle:sync` и bundle parity;
- native Windows pure-backend subset;
- named identity/Resize/Split/Merge/opening/import smokes из AC;
- model invariants, mutation gate, config audit и migration benchmark.

Полный Linux backend, all-smoke, golden и performance_smoke остаются точным-SHA
предрелизным gate по процессу.

## 15. План реализации

1. Ввести pure catalog types, deterministic migration и shared fixtures без
   подключения product writers.
2. Добавить backend schema/parity и model version, оставить read-only v7 path.
3. Подключить runtime compatibility projection; доказать render equivalence.
4. Перевести room wall selection/thickness/opening host на ID.
5. Подключить writer barrier и lineage hints по операциям, затем source guard.
6. Подключить import/export/duplicate/Undo/recovery и stale-client rejection.
7. Добавить Optimize preview/report, i18n, docs и changelog.
8. Прогнать fast gates, named smokes, build/sync; передать независимому reviewer.

Каждый промежуточный commit компилируется и не включает half-migrated writer в
default path. Feature flag в persisted config не добавляется: v8 включается
только фактом успешной materialization.

## 16. Риски и меры

| Риск | Мера |
|---|---|
| Catalog и poly расходятся | один commit barrier + backend parity + stale-client reject |
| Shared partial edge получает два ID | global atomization по axis/owners + shared fixture AC1/2 |
| Resize пересоздаёт ID | explicit lineage hints + AC3 mutant |
| Split теряет opening | deterministic child rule и physical rehost AC4/6 |
| Старый клиент портит v8 | compatibility projection для read, fail-closed structural write AC9 |
| Migration выбирает неверный key-only wall | текущий resolver без новых эвристик; ambiguity blocks |
| 200k theoretical edges дают freeze | indexed O(E log E), async preview boundary, benchmark/limits |
| Новый writer обходит model | executable source/AST guard AC5 |
| Новая identity используется для удаления старых geometry guards | explicit AC12 prohibition |
| #306 конфликтует с моделью `cm:0` | #282 не меняет UI/open-boundary semantics; #306 later rebases on catalog |

## 17. Откат

До первой v8 записи — чистый revert кода, данные v7 не менялись. После v8
materialization старый stable release может показать compatibility `poly/walls`,
но безопасное редактирование им не гарантируется.

Штатный rollback продукта:

1. отключить structural v8 writes, сохранив v8 read/projection;
2. выпустить follow-up reader hotfix;
3. не удалять catalog и IDs автоматически;
4. восстановить pre-migration config только из обычного backup/Undo,
   инициированного пользователем.

Автоматический downgrade v8 → v7 запрещён: он теряет hosted wall identity и
может неоднозначно схлопнуть атомы. Revert implementation-коммита без v8 reader
после публикации также запрещён.

## 18. Release-артефакты

- implementation commit: `Issue: #282`, `User-Visible: yes`;
- оба changelog со ссылкой на #282 и формулировкой про устойчивое редактирование,
  без обещания нового UI;
- generated bundle snapshots синхронизированы;
- новые golden baselines принимаются только при реальной visual delta и только
  из полного Linux artifact по процессу;
- beta/RC обязательна до stable;
- issue закрывается только после успешного beta gate на exact SHA.

## 19. Принятые технические предположения (оспоримы ревьюером)

1. Stage 1 поставляется в #282; Stages 2–4 получают отдельные issues.
2. `wall_segments + room.wall_ids` — canonical identity/thickness, а `poly` и
   generated `walls[]` временно остаются compatibility projection до Stage 3.
3. Independent partitions не переносятся в catalog: их ID уже stable. Draft
   segment IDs добавляются, потому что draft переживает сессию и конвертируется.
4. `cm:0` нужен для полного catalog, но не открывает пользователю функционал
   #306 и не заменяет `open_spans/open_to` этой задачей.
5. Migration выполняется lazy on structural write/Optimize, не на read и не на
   device/layout-only save; внутри одной транзакции она всегда получает
   candidate после `canonicalizeConfigGeometry` #291 с его порогом `1e-4` шага.
6. Старый client может читать projection, но structural writes в v8 fail-closed.
7. Deterministic hash используется только для первоначальной migration; после
   неё geometry никогда не определяет ID.
8. Existing wall renderer и junction algorithms получают adapter projection и
   не переписываются до ADR Stage 4.
