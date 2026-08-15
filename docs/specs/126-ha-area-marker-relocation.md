# Issue #126 — HA Area переносит marker в новую комнату

- **Issue:** https://github.com/Matysh/houseplan-card/issues/126
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** bug, обычный трек
- **Пользовательское изменение:** да

## 1. Сценарий

Администратор переносит устройство или standalone entity в другую Area средствами
Home Assistant. House Plan уже открыт либо загружается позже. Если принадлежность
marker не переопределена в House Plan, план должен сам показать объект в комнате,
связанной с новой Area, и обратить внимание администратора красной меткой.

## 2. Что человек увидит до и после

До изменения сохранённая позиция оставляет marker в прежней комнате при смене HA
Area внутри одного пространства; после изменения marker появляется в автосетке
новой комнаты с обычной красной меткой «требует внимания».

## 3. Проблема

Layout keyed по marker id и space, но не хранит provenance комнаты/Area.
`_livePos()` принимает сохранённые координаты, пока `saved.s === d.space`, а
`_syncNewDevices()` сравнивает только множество id. Поэтому изменение Area внутри
того же space не инвалидирует position и не добавляет `new_device_ids`.

Это нарушает J6: план продолжает показывать устройство там, где его больше нет,
и не сообщает администратору о расхождении.

## 4. Решения владельца

1. Сохранённая после drag позиция — раскладка, а не принадлежность; смена HA Area
   её перебивает.
2. Явные `marker.area` и `marker.room_id` всегда побеждают registry Area.
3. Новое место выбирает обычная автосетка комнаты, не строгий центр.
4. Переезд использует существующий красный badge `new_device_ids`, без нового
   вида состояния.
5. Охвачены device и entity markers, если их effective room получена напрямую
   из HA registry. Composite light groups с Area, выведенной из одного участника,
   автоматически не переносятся.

## 5. Scope

- обнаружение смены authoritative registry Area для eligible marker;
- invalidation сохранённого layout даже в том же space;
- автоматическая позиция в новой комнате через canonical `defaultPositions`;
- existing red new-device attention и его обычный acknowledgement;
- live registry refresh, cold start, multi-client config/layout events;
- migration/backfill для уже существующих layout без Area provenance;
- device/entity binding, explicit override и composite-group exclusions;
- frontend/backend schema validation, unit/backend/smoke coverage и docs.

## 6. Не входит в задачу

- управление Area в HA из House Plan;
- перенос Area самой комнаты или изменение room↔Area binding;
- новый badge/history/notification/toast для переезда;
- Undo/Redo внешнего registry change;
- автоматический перенос composite/folded light groups;
- сохранение старой ручной позиции как recoverable history;
- переразмещение при каждом registry rebuild без фактической смены Area;
- lifecycle устройств без Area либо Area, не привязанной к комнате — это #29.

## 7. Источник принадлежности и eligibility

Для каждого renderable marker вычисляется `PlacementAuthority`:

1. `marker.room_id` — explicit House Plan room, auto-relocation запрещена;
2. `marker.area` — explicit House Plan Area, auto-relocation запрещена;
3. direct registry Area device binding — eligible;
4. direct registry Area standalone entity binding — eligible;
5. Area, выведенная из member composite/group/fold — ineligible;
6. virtual/no authoritative Area — ineligible.

Один pure resolver используется discovery, placement и relocation. Нельзя
определять eligibility по id prefix, icon или текущим координатам.

Registry snapshot считается authoritative только после полного registry load.
Limited-permission/unverified кадр не считается сменой Area и не удаляет position.

## 8. Persisted provenance

Чтобы отличить новую Area от reload с уже сохранённой позицией, config settings
получают optional internal map:

```ts
settings.marker_area_snapshot?: Record<markerId, areaId>
```

Имя может быть уточнено ревьюером, но semantics фиксированы:

- значение — последняя успешно обработанная direct registry Area;
- map bounded множеством известных eligible marker ids;
- tombstone/removed/missing ids очищаются вместе с действующей lifecycle hygiene;
- поле не является пользовательской настройкой и не отображается в UI;
- unknown sibling keys сохраняются по compatibility policy;
- backend validator ограничивает key/value strings и общий config-size budget.

Layout v2 (`{s,x,y}`) не расширяется: принадлежность — discovery/config lifecycle,
а не геометрия координаты. Это исключает divergent Area metadata в каждой
position write.

## 9. Обнаружение и обработка смены Area

После authoritative registry rebuild для eligible marker:

1. получить previous area из snapshot;
2. получить current direct registry area;
3. разрешить current area ровно в одну room текущего model;
4. если previous=current — no-op;
5. если target room отсутствует/неоднозначна — отложить, snapshot не продвигать;
6. если area изменилась — удалить saved layout marker id;
7. пересчитать общую автосетку target room;
8. добавить marker id в existing `new_device_ids`;
9. только после успешной layout invalidation записать snapshot=current.

Порядок fail-safe: layout delete раньше config snapshot. Если config write затем
падает, повторная обработка идемпотентно удалит уже отсутствующий layout и снова
попытается записать attention. Нельзя сначала признать Area обработанной, а потом
оставить старую позицию при ошибке layout store.

Локальные `_layout`, `_defPos`, dirty/sent position state и render snapshot
обновляются атомарно для кадра; промежуточный marker в старой комнате после
authoritative event не показывается.

## 10. Initial backfill старых конфигов

При отсутствии snapshot для eligible marker:

- если saved layout отсутствует — записать current Area без attention/move;
- если saved point лежит внутри комнаты с той же Area — сохранить position и
  записать current Area;
- если saved point однозначно лежит внутри другой room с другой Area, считать это
  уже существующим stale same-space case: удалить position, автопоставить в
  current room и добавить `new_device_ids`;
- если point вне всех комнат, на границе нескольких комнат либо geometry
  невалидна — сохранить position и записать current Area; небезопасную историю
  по координате не угадывать;
- explicit override и composite group в backfill не участвуют.

Point-in-room использует canonical final room polygons в plan coordinates, без
decor/device bounds. Backfill выполняется один раз и не превращает обычный reload
в постоянное auto-layout.

## 11. Автосетка и attention

Удаление saved position возвращает marker в тот же `defaultPositions()` path,
который уже используется для нового устройства и переезда между пространствами.
Сетка учитывает другие markers комнаты и выдаёт normalized finite position.

`new_device_ids` переиспользуется дословно:

- badge, цвет, фильтрация и acknowledgement остаются прежними;
- повторные registry events не добавляют duplicate id;
- acknowledgement не возвращает старую position и не меняет snapshot;
- несколько переехавших markers раскладываются одним детерминированным pass, а
  не все в центр.

External relocation не попадает в position-only Undo stack #74. Это изменение
источника истины, а не команда редактора.

## 12. Multi-client и races

- Первый клиент, успешно обработавший event, публикует layout/config revisions;
  остальные принимают их обычным subscription path.
- Concurrent drag со старой layout revision не должен воскресить position после
  relocation; existing expected revision/conflict resync остаётся authority.
- Если пользователь в House Plan успел сохранить explicit room override до
  commit relocation, свежий config reload отменяет auto move.
- Registry event без изменившегося fingerprint не создаёт writes.
- Ошибка backend оставляет диагностируемый retryable state без production loop;
  snapshot не продвигается мимо неуспешного layout delete.

## 13. UX, touch и accessibility

Новое управление не добавляется. В View/Device editor marker визуально появляется
в новой room; красная метка доступна тем же mouse/touch/keyboard paths, что у
нового устройства. На touch View это release-blocking display correctness.

Перемещение не переносит DOM focus на marker и не открывает dialog. Если dialog
этого marker открыт во время registry change, он закрывается либо refresh-ится по
действующему stale-binding contract; сохранить старую room через stale draft
нельзя.

## 14. Модель данных, migration и compatibility

- Добавляется только optional internal snapshot map §8.
- Backend Store version не повышается, если optional field валидируется без
  destructive rewrite; отсутствие поля запускает frontend backfill §10.
- Поле регистрируется в `docs/CONFIG-COMPATIBILITY.md` и
  `scripts/config-field-registry.mjs` с owner, read/write/cleanup policy.
- Export/import сохраняет snapshot только как internal lifecycle metadata по
  текущей full-config policy; restore на другом HA не может автоматически
  перемещать marker до authoritative registry comparison.
- Unknown/legacy values fail safe: invalid entry игнорируется для конкретного id,
  но не стирает layout до §10 inference.

## 15. i18n

Новых строк нет: используется существующая красная метка и текущие названия
комнат/devices. Если реализация добавляет toast или отдельную подпись «переехал»,
это выходит за принятое решение и требует отдельного product scope.

## 16. Acceptance criteria

1. **AC1 — same-space relocation.** Direct-registry device с saved layout после
   Area A→B в том же space теряет saved position, попадает в автосетку room B и
   получает existing red badge. **Доказательство:** unit + browser smoke.
2. **AC2 — cross-space parity.** Тот же outcome действует при переходе между
   spaces и не регрессирует уже работающий case. **Доказательство:** unit/smoke.
3. **AC3 — explicit wins.** `marker.room_id`/`marker.area` сохраняют room и saved
   position при HA Area change. **Доказательство:** resolver unit matrix.
4. **AC4 — binding scope.** Direct device/entity markers переносятся; composite/
   inferred groups и virtual markers — нет. **Доказательство:** unit matrix.
5. **AC5 — backfill.** Старый saved point в другой однозначной room исправляется;
   same-room/outside/ambiguous point безопасно сохраняется. **Доказательство:**
   migration unit + cold-start smoke.
6. **AC6 — attention lifecycle.** Existing `new_device_ids` badge ставится один
   раз и очищается обычным acknowledgement без нового state kind.
   **Доказательство:** logic unit + browser smoke.
7. **AC7 — fail-safe writes.** Config snapshot не продвигается при failed layout
   delete; retry и concurrent revision не воскрешают stale position.
   **Доказательство:** backend/frontend failure tests.
8. **AC8 — no Undo.** External relocation не добавляется в #74 stack.
   **Доказательство:** command-stack unit/source contract.
9. **AC9 — bounded/performance.** No-change registry rebuild даёт zero writes и
   O(markers+rooms) bounded pass. **Доказательство:** counter unit + performance smoke.
10. **AC10 — compatibility.** Старые config/layout читаются, invalid snapshot
    fail-safe, limits/exports documented. **Доказательство:** backend validation,
    round-trip tests и registry audit.

## 17. План автотестов

### Unit

- placement authority device/entity/explicit/composite/virtual matrix;
- same-space/cross-space/no-change/unbound target transitions;
- deterministic multi-marker autogrid;
- backfill point in same/other/outside/boundary/degenerate room;
- red badge add/dedupe/acknowledge;
- no command-stack entry and no write on identical registry fingerprint;
- failure ordering and stale revision recovery.

### Backend

- optional snapshot validation, limits and unknown fields;
- config round-trip/export/import;
- layout delete revision event and conflict behavior;
- native Windows pure subset may run, full HA harness authority is Linux CI/WSL.

### Browser smoke

- live HA registry Area change within one space with saved drag position;
- same transition for standalone entity marker;
- explicit room override, composite group exclusion;
- cold start from old config stale point;
- two devices moving together use separate autogrid slots;
- two-card/multi-client revision event;
- View/touch red badge and dialog open during transition.

### Golden/performance

- before/after fixture with marker and red badge in target room;
- no unrelated visual baseline acceptance;
- large registry no-change and relocation counters; no long task or repeated write.

## 18. Затронутые поверхности

- registry/device rebuild and placement lifecycle in `src/houseplan-card.ts`;
- pure placement/new-device helpers in `src/logic.ts`, `src/space-geometry.ts` or
  focused new module;
- config/backend validation and compatibility registry;
- layout/config event tests, browser/golden/performance fixtures;
- `docs/ARCHITECTURE.md`, `docs/FILTERING.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 19. Риски и откат

| Риск | Мера |
| --- | --- |
| Старый manual layout ошибочно принят за stale | backfill только при однозначной другой room |
| Config говорит processed до layout | delete-first fail-safe ordering |
| Group прыгает по Area участника | direct-provenance eligibility |
| Multi-client возвращает старую позицию | revision conflict/resync |
| Registry временно пуст | authoritative-frame guard |

Откат прекращает чтение/запись snapshot map и возвращает прежнюю priority saved
layout. Optional metadata можно оставить ignored; destructive rollback не нужен.

## 20. Release-артефакты

Implementation commit имеет `User-Visible: yes` и одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — registry Area, explicit room override и red badge;
- `docs/ARCHITECTURE.md`, `docs/FILTERING.md`,
  `docs/CONFIG-COMPATIBILITY.md`;
- `docs/TESTING.md`.

Нужны targeted browser/golden artifacts, exact backend/unit commands и Linux CI
HA-harness evidence.

## 21. Принятые технические предположения

- Area provenance хранится bounded internal config map, не в layout entry;
- old-layout repair использует canonical point-in-room только для однозначного
  stale case;
- layout delete выполняется раньше snapshot commit;
- unbound/ambiguous Area откладывает обработку и не продвигает snapshot;
- точное имя map/helper можно изменить на ревью без изменения semantics.
