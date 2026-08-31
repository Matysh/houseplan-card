# ТЗ #126 — HA Area переносит marker в новую комнату

- **Issue:** https://github.com/Matysh/houseplan-card/issues/126
- **Статус документа:** актуализировано на `dev@6bf39ee9a7ecbc62dcc8b999af3c23b6d877c5a0`, готово к spec review
- **Приоритет:** P1
- **Тип:** bug, полный трек
- **Пользовательское изменение:** да

## 1. Продуктовый сценарий

Персона — Home admin; поверхность — View, Devices editor и hosted Static; момент —
после изменения Area устройства или standalone entity средствами Home Assistant.

Администратор меняет Area в HA. Если принадлежность marker комнате не
переопределена в House Plan, объект должен автоматически оказаться в автосетке
комнаты, связанной с новой Area, и получить существующую красную метку
«требует внимания».

До: сохранённая ручная позиция удерживает marker в прежней комнате, если старая
и новая комнаты находятся в одном пространстве. После: authoritative HA Area
перебивает сохранённую раскладку, и все View-поверхности показывают marker в
новой комнате.

Задача закрывает J6 из `docs/SCOPE.md`: план не должен продолжать показывать
устройство там, где его больше нет.

## 2. Подтверждённая причина на текущем dev

`buildDevices()` уже пересчитывает `DevItem.area` и `DevItem.space` из registry.
Однако `_livePos()` принимает сохранённую запись layout, пока совпадает только
`saved.s === device.space`. Комната/Area в layout не записана. Поэтому:

- между разными spaces сохранённая позиция уже перестаёт применяться;
- между комнатами одного space старая позиция продолжает побеждать новую
  `_defaultPositions()`;
- `_syncNewDevices()` сравнивает только identity устройства, поэтому Area
  transition не добавляет `new_device_ids`.

Hosted Static повторяет дефект через `space-geometry.ts::markerPos()`.

## 3. Решения владельца

1. Сохранённая после drag позиция — раскладка, а не принадлежность; смена HA Area
   её перебивает.
2. Явные `marker.area` и `marker.room_id` всегда побеждают registry Area.
3. Новое место выбирает обычная автосетка комнаты, не строгий центр.
4. Используется существующая красная метка `new_device_ids`, без нового вида
   badge или уведомления.
5. Охвачены direct device и entity markers, если effective room получена из HA
   registry. Автоматические composite light groups не переносятся по Area одного
   участника.

## 4. Выпущенные соседние контракты

### #29 — каталог и lifecycle устройств

- `settings.new_device_ids` остаётся persisted источником красной метки;
- переехавший marker остаётся в категории «На плане» и получает признак «Новое»;
- открытие каталога и Find не подтверждают метку, открытие Device editor —
  подтверждает существующим путём;
- hide/remove/HA-disabled semantics не меняются.

### #74 — position-only Undo/Redo

- registry relocation не создаёт history command;
- pending relocation отменяет активный drag этого marker;
- position history очищается, чтобы Undo не воскресил принятую старую позицию;
- authoritative layout event другого клиента продолжает очищать history
  существующим механизмом.

### #317 — effective room placement

Явное назначение определяется действующим правилом:

- непустой `marker.area` — explicit Area target;
- `marker.area == null` вместе с непустыми `marker.space` и `marker.room_id` —
  explicit local-room target;
- иначе direct device/entity marker следует registry Area.

Тот же смысл применяется к визуальному размещению и room-climate membership.
Нельзя вводить вторую несовместимую трактовку `area/space/room_id`.

## 5. Scope

- детерминированное обнаружение authoritative direct registry Area transition;
- немедленное runtime-игнорирование stale saved position во всех View;
- удаление stale layout первым клиентом с write permission;
- placement через существующую общую автосетку target room;
- existing red `new_device_ids` attention и обычный acknowledgement;
- live registry refresh, cold start, reload и multi-client config/layout events;
- безопасный one-time backfill старых configs без provenance;
- device/entity binding, explicit override и composite-group exclusions;
- frontend/backend schema, import/export compatibility, unit/backend/smoke/docs.

## 6. Не входит в задачу

- управление HA Area из House Plan;
- перенос Area самой комнаты или изменение room↔Area binding;
- новый badge, toast, history, notification либо отдельная категория каталога;
- Undo/Redo внешнего registry change;
- автоперенос automatic/composite light groups;
- восстановление старой ручной позиции после переезда;
- изменение `marker.area`, `marker.room_id` или layout при временно
  неавторитетном registry snapshot;
- lifecycle устройств без Area либо с Area, не привязанной ровно к одной комнате
  плана — это действующий scope #29.

## 7. Единый pure resolver

Вводится provider-neutral pure-модуль (рабочее имя
`src/device-area-relocation.ts`). Он не импортирует Lit, не вызывает HA и не
пишет stores. На вход получает:

- полный список текущих `DevItem`;
- current model всех spaces/rooms;
- layout snapshot;
- persisted Area provenance;
- признак authoritative registry snapshot.

На выходе:

```ts
type MarkerAreaProvenance = {
  binding: `device:${string}` | `entity:${string}`;
  area: string;
};

type AreaRelocationDecision = {
  markerId: string;
  binding: MarkerAreaProvenance['binding'];
  currentArea: string;
  targetSpaceId: string;
  targetRoomId: string;
  kind: 'baseline' | 'relocate' | 'defer';
  reason:
    | 'unchanged'
    | 'new-without-layout'
    | 'backfill-same-room'
    | 'backfill-stale-room'
    | 'backfill-cross-space'
    | 'backfill-ambiguous'
    | 'area-changed'
    | 'target-unresolved'
    | 'registry-unverified';
};
```

Exact названия можно изменить без изменения semantics. Один и тот же resolver
используют interactive card, hosted Static, persistence coordinator и tests.

## 8. Eligibility и источник Area

Eligible:

1. markerless auto device с `bindingKind:'device'`;
2. saved direct `device:` marker без explicit placement;
3. saved direct `entity:` marker без explicit placement, включая standalone
   entity и entity с parent device;
4. HA-disabled saved direct marker, если полный authoritative registry всё ещё
   содержит exact binding и Area: при реактивации он должен появиться правильно.

Ineligible:

- virtual marker;
- marker с explicit placement по §4;
- markerless auto `entity:` light group;
- composite/fold/group, чья Area выведена не из exact direct binding;
- removed marker;
- orphaned/unverified binding;
- binding без непустой direct registry Area.

Direct entity Area = `entity.area_id || parentDevice.area_id`. Direct device
Area = `device.area_id`. Friendly name, icon, model, current coordinates и id
prefix не являются доказательством принадлежности.

`bindingKind: 'entity'` сам по себе недостаточен: такой же kind сейчас имеют
автоматические light groups. Direct entity marker подтверждается наличием
сохранённого `marker` с exact `binding === entity:${bindingRef}`. Markerless
`lg_*`/composite item исключается независимо от Area участника; prefix служит
только defensive check, не основным discriminator.

Area должна разрешаться **ровно в одну** room текущего model. Дубликат Area у
нескольких комнат считается ambiguous: решение `defer`, position и provenance
не меняются.

## 9. Persisted provenance

Config settings получает optional internal map:

```ts
settings.marker_area_snapshot?: Record<string, {
  binding: `device:${string}` | `entity:${string}`;
  area: string;
}>;
```

Ключ — runtime marker id: HA device id у auto device либо `marker.id` у saved
marker. Exact binding хранится обязательно. Без него rebind того же marker id к
другому устройству ошибочно выглядел бы как HA Area transition.

Контракт поля:

- это bounded lifecycle metadata, не пользовательская настройка;
- вводится самостоятельный backend limit
  `MAX_MARKER_AREA_SNAPSHOT = MAX_KNOWN_DEVICES = 20_000` entries; дополнительно
  действует общий `MAX_CONFIG_BYTES = 2 MiB`;
- entries имеют только bounded strings `binding` и `area`;
- запись с другим binding считается новым baseline/backfill, не relocation;
- explicit/ineligible marker очищает собственную старую entry;
- отсутствующий в runtime marker не очищается только из-за active-only roster:
  authoritative full registry/marker lifecycle решает, существует ли binding;
- deleted/rebound/nonexistent exact binding очищается действующей lifecycle
  hygiene;
- layout v2 не расширяется: provenance принадлежности не дублируется в
  координатах.

## 10. Runtime-проекция до persistence

После каждого authoritative registry rebuild resolver вычисляет множество
`relocate`.

- `_livePos()` interactive card и `markerPos()` hosted Static игнорируют saved
  layout для этих ids и используют existing default position target room;
- interactive effective attention = persisted `new_device_ids` плюс pending
  relocate ids. Это не второй persisted источник, а проекция ещё не
  подтверждённого перехода;
- read-only клиент показывает правдивое новое положение, но не вызывает
  config/layout writes и не получает дополнительных прав;
- первый клиент с `_canEdit === true` запускает persistence coordinator;
- ordinary HA state ticks и повторный идентичный registry fingerprint не
  создают новую работу.

Таким образом медленный backend или отсутствие admin-card не заставляют View
показывать marker в заведомо старой комнате.

## 11. Обработка подтверждённой смены Area

Для entry с тем же binding:

1. `previous.area === currentArea` → `baseline/unchanged`, no-op;
2. current Area не разрешается ровно в одну room → `defer`, snapshot не
   продвигается;
3. Area изменилась → `relocate` независимо от сохранённой drag position;
4. отменить active drag marker и очистить position history;
5. удалить saved layout через `houseplan/layout/delete`;
6. после успешного либо уже идемпотентного delete добавить id в
   `new_device_ids` и записать provenance `{binding,currentArea}`;
7. отправить одну сериализованную config mutation для batch текущего rebuild.

Порядок fail-safe: layout delete раньше продвижения provenance. Если config write
после delete падает, старый snapshot остаётся на сервере; следующий
authoritative pass повторит idempotent delete и attention write. Нельзя признать
Area обработанной, оставив серверную старую позицию.

Пока persist выполняется, in-flight ids дедуплицируются. Toggle space, hover,
render и второй идентичный registry callback не создают parallel delete/config
loop.

## 12. Initial backfill старых configs

Если entry отсутствует либо binding в ней отличается:

- saved layout отсутствует → записать baseline без attention;
- `saved.s` указывает другое пространство, чем target room → удалить stale
  position и добавить attention;
- saved point строго и однозначно лежит внутри target room → сохранить position
  и записать baseline;
- saved point строго и однозначно лежит внутри другой room с другой непустой HA
  Area → считать существующим stale case, удалить position, автопоставить в
  target room и добавить attention;
- source room без HA Area, point вне rooms, на стене/границе нескольких rooms
  либо при invalid geometry → сохранить position и записать baseline; историю
  без доказательства не угадывать.

Point-in-room использует canonical final room polygons в plan coordinates и
отдельно отсекает boundary. Decor/device bounds и wall body не участвуют.

Backfill выполняется одним bounded pass и одним config write. Повторный reload
видит provenance и не превращает inference в постоянный auto-layout.

## 13. Автосетка и attention

Удаление saved position возвращает marker в тот же `defaultPositions()` path,
который уже используется для новых устройств и cross-space Area placement.
Несколько marker, переехавших одновременно, раскладываются общим
детерминированным pass и не накладываются в центре.

`new_device_ids` переиспользуется без смены UI/формата:

- badge, каталог, фильтрация и acknowledgement остаются как в #29;
- duplicate id не добавляются;
- acknowledgement не возвращает старую position и не меняет provenance;
- external relocation не попадает в history #74;
- explicit hidden marker сохраняет user-hidden состояние; relocation не
  превращается в Show;
- HA-disabled marker остаётся service ghost/hidden по действующему контракту,
  но после реактивации использует уже новую комнату.

## 14. Multi-client, revisions и races

- Клиенты вычисляют одинаковую runtime-проекцию из общего config/registry.
- Первый writer сериализованно удаляет layout и обновляет config; остальные
  принимают обычные revision events.
- Concurrent drag отменяется при local transition. Старый remote drag write не
  должен воскресить position после принятого delete: существующие layout
  revision/resync и pending delete authority остаются обязательными.
- Если explicit override сохранён до relocation commit, свежий config rebuild
  делает marker ineligible и отменяет auto mutation.
- Rebind того же marker id не является Area transition из-за binding в
  provenance; применяется backfill нового binding.
- Временный limited/unverified registry не создаёт отрицательного вывода,
  cleanup, move или write.
- Ошибка layout delete оставляет provenance старым и состояние retryable без
  timer loop; runtime View по-прежнему может показывать безопасную новую
  default position.

## 15. UX, touch и accessibility

Новых controls, dialogs и строк нет. Marker визуально появляется в target room
с существующей красной меткой. Focus не переносится, dialog не открывается.

Если Device dialog этого marker открыт в момент authoritative transition, его
не требуется принудительно закрывать или перехватывать focus. При Save dialog
обязан заново разрешить binding по актуальному registry: несвязанные изменения
сохраняются, но stale room draft не может вернуть marker в прежнюю комнату или
создать explicit override. Registry-following placement остаётся authoritative.

View и kiosk на touch обязаны показать то же положение, что desktop View.
Devices editor остаётся desktop-first, но не может отображать старую позицию
после authoritative transition.

## 16. Model, import/export и compatibility

- Добавляется только optional `settings.marker_area_snapshot`.
- Model/Store version не повышается.
- Backend schema валидирует структуру, lengths и общий config budget.
- Config field регистрируется в `scripts/config-field-registry.mjs` и
  `docs/CONFIG-COMPATIBILITY.md`.
- Same-source full backup сохраняет snapshot вместе с lifecycle metadata.
- Full import из другого source/HA удаляет `marker_area_snapshot` вместе с
  `known_devices/new_device_ids`: чужие HA ids/Areas не являются provenance
  нового дома и должны пройти backfill.
- Space-only import не переносит глобальный snapshot из документа.
- Старый frontend игнорирует unknown setting; новый читает отсутствие поля как
  backfill, не как пустую историю смен Area.
- Backend schema отклоняет новую запись/import с невалидной map или entry.
  Defensive frontend, если такие данные всё же попали из старого/внешнего
  источника в обход schema, игнорирует только повреждённую entry и применяет к
  её marker безопасный backfill; остальные entries продолжают работать.

## 17. i18n

Новых строк нет. Используются существующие badge, catalog labels и save-error
toast. Если реализация добавляет «Устройство переехало», отдельный toast или
новый badge, это выходит за принятый scope.

## 18. Acceptance criteria

1. **AC1 — same-space relocation.** Direct-registry device с saved layout после
   Area A→B в том же space игнорирует и удаляет saved position, попадает в
   автосетку room B и получает existing red badge. Доказательство: unit +
   production-bundle smoke.
2. **AC2 — cross-space parity.** Тот же outcome действует между spaces; старая
   layout entry удаляется, а не остаётся orphan. Доказательство: unit + smoke.
3. **AC3 — immediate/read-only/static truth.** До persistence interactive
   read-only View и hosted Static игнорируют stale position; writes выполняет
   только writer. Доказательство: pure unit + hosted/full render smoke.
4. **AC4 — explicit wins.** `marker.room_id`/`marker.area` сохраняют room и
   saved position при HA Area change. Доказательство: authority matrix.
5. **AC5 — binding scope.** Auto device и direct device/entity markers
   переносятся; composite light group и virtual marker — нет. HA-disabled saved
   marker корректно появляется после re-enable. Доказательство: unit matrix.
6. **AC6 — safe backfill.** Cross-space и однозначная другая HA room
   исправляются; same-room/outside/boundary/area-less/ambiguous сохраняются.
   Доказательство: unit + cold-start smoke.
7. **AC7 — attention lifecycle.** Existing `new_device_ids` badge ставится один
   раз, отражается каталогом и очищается обычным acknowledgement без нового
   state kind. Доказательство: unit + browser smoke.
8. **AC8 — rebind provenance.** Тот же marker id с другим exact binding не
   считается Area transition. Доказательство: unit.
9. **AC9 — fail-safe writes.** Snapshot не продвигается при failed layout
   delete; failed config write повторяется после следующего authoritative pass;
   concurrent revision не воскрешает stale position. Доказательство:
   frontend/backend failure tests.
10. **AC10 — no Undo.** Relocation не создаёт command, отменяет active drag и
    очищает stale position stack. Доказательство: history unit/source contract.
11. **AC11 — bounded/no-loop.** No-change registry rebuild даёт zero writes;
    simultaneous transitions batch config mutation; in-flight work deduped.
    Доказательство: counter/performance unit.
12. **AC12 — compatibility.** Backend round-trip, same/cross-source import и
    config-field audit выполняют §16. Доказательство: backend tests + registry
    audit.

## 19. Обязательные тесты

### Unit

- placement authority: auto device/direct device/direct entity/explicit local
  room/explicit Area/composite/virtual/removed/disabled/unverified;
- previous=same/different/missing/binding-changed;
- same-space/cross-space/unresolved/duplicate Area targets;
- backfill point: target/other HA room/area-less/outside/boundary/ambiguous;
- deterministic multi-marker default grid;
- effective pending attention, dedupe/acknowledge;
- no history command, active drag cancellation, no write on identical
  authoritative fingerprint;
- mutation/failure ordering and cleanup bounds.

### Backend

- optional structured map validation, string/entry/config limits;
- config round-trip and unknown siblings;
- same-source preserve, cross-source strip, space-only import isolation;
- layout delete idempotence/revision event and conflict path.

### Browser smoke

Новый targeted smoke `demo/smoke_area_relocation.mjs` либо эквивалент обязан
проверить production bundle:

- live Area A→B одного space после drag;
- cross-space;
- standalone entity marker;
- explicit room override и composite exclusion;
- cold-start stale backfill;
- existing red badge/acknowledgement;
- hosted Static и read-only projection;
- no config/layout call при unchanged rebuild.

Golden baseline не меняется: новый визуальный язык не вводится. Полный golden и
performance остаются pre-beta gates.

Performance budget: resolver запускается только на authoritative registry/model
rebuild, имеет линейную сложность по markers + rooms, не вызывается из render и
при unchanged input не создаёт layout/config writes.

## 20. Затронутые поверхности

- новый pure resolver `src/device-area-relocation.ts`;
- registry/device rebuild, effective attention и persistence coordinator в
  `src/houseplan-card.ts`;
- shared `markerPos()`/static render в `src/space-geometry.ts` и
  `src/space-render.ts`;
- `ServerConfig` types, backend validation и import/export;
- config-field registry, unit/backend/browser fixtures;
- `docs/ARCHITECTURE.md`, `docs/FILTERING.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.md`,
  `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, оба changelog.

## 21. Риски и откат

| Риск | Мера |
|---|---|
| Rebind принят за Area change | provenance хранит exact binding |
| Старый manual layout ошибочно принят за stale | backfill только при cross-space либо одной другой HA room |
| Read-only продолжает показывать старую room | shared runtime projection игнорирует stale layout до persistence |
| Config признал transition до layout | delete-first ordering |
| Undo/remote drag воскресил position | cancel/clear history + pending delete/revision authority |
| Composite group прыгает по Area участника | direct-binding eligibility |
| Registry временно пуст | authoritative snapshot guard |
| Несколько clients пишут одно и то же | idempotent delete, serialized config, revision reload, in-flight dedupe |

Откат прекращает вычислять runtime relocations и читать/писать snapshot map,
возвращая saved-layout priority. Optional metadata можно оставить ignored;
destructive rollback и model downgrade не нужны.

## 22. Release-артефакты

Implementation commit имеет `User-Visible: yes` и одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- EN/RU user guides — registry Area, explicit House Plan room и red badge;
- architecture/filtering/config-compatibility/testing docs;
- targeted smoke contract и exact local gate evidence в issue.

## 23. Принятые технические предположения

- provenance — bounded structured map в global settings, не layout metadata;
- самостоятельный предел snapshot — 20 000 entries плюс общий wire/config limit
  2 MiB;
- exact binding входит в entry и защищает rebind;
- direct entity отличается от composite group по exact persisted marker binding,
  а не только по `bindingKind` или префиксу id;
- pending relocation является derived runtime projection, а не вторым store;
- writer batches decisions одного authoritative rebuild;
- layout delete предшествует provenance commit;
- cross-source import удаляет lifecycle provenance;
- old-layout repair использует только строгий однозначный point-in-room;
- точные helper/type names можно изменить на review без изменения semantics.
