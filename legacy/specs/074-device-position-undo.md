# Issue #74 — position-only Undo/Redo в редакторе устройств

- **Issue:** https://github.com/Matysh/houseplan-card/issues/74
- **Статус документа:** готово к ревью ТЗ (`S4-spec-review` после публикации)
- **Приоритет:** P2
- **Тип:** feature/polish, полный трек
- **Пользовательское изменение:** да

## 1. Пользовательский результат

### До

В редакторе устройств любое ошибочное перетаскивание сразу меняет серверный
layout. Кнопок Undo/Redo нет, а `Ctrl/Cmd+Z` в этом редакторе ничего не делает.
Во время одного drag текущая реализация вызывает `_savePos()` на каждом
`pointermove`, поэтому жест не имеет явной транзакционной границы.

### После

Одно завершённое перемещение одного устройства становится одной локальной
командой. Пользователь может отменить и повторить до 50 перемещений кнопками в
панели редактора или стандартными shortcuts. Undo меняет только положение
маркера: настройки, привязки, жизненный цикл устройства и объекты других
редакторов не затрагиваются.

### Основной пользователь

Функция предназначена для администратора Home Assistant, который раскладывает
устройства по плану в desktop-first редакторе. Гарантированный touch-контракт
View не расширяется, но отменённый системой touch-жест не должен сохранять
случайную позицию.

## 2. Актуальность на 2026-08-30

Задача полностью актуальна на текущем `dev`:

- `CommandStack` используется для геометрии и декора, но отдельной истории
  позиций устройств нет;
- Device toolbar не содержит Undo/Redo;
- keyboard handler выходит до обработки history в режиме `devices`;
- `_pointerMove()` вызывает `_savePos()` и планирует persist на каждом кадре;
- `pointercancel` сейчас направлен в обычный `pointerup`, поэтому отменённый
  браузером жест фактически коммитится;
- backend уже предоставляет точечные `houseplan/layout/update` и
  `houseplan/layout/delete`, менять API или схему не требуется.

## 3. Цели

1. Один успешно завершённый drag — одна команда и одна финальная запись.
2. Undo/Redo доступны только в Device editor кнопками и стандартными shortcuts.
3. Первый drag auto-positioned устройства полностью обратим до отсутствующей
   explicit layout-записи.
4. Preview, commit, abort и persist failure имеют однозначный контракт.
5. Position-only merge сохраняет `k`, включая `k: 0`, и неизвестные future поля.
6. Собственный server echo сохраняет историю, несовместимое внешнее изменение
   безопасно её инвалидирует.

## 4. Не входит в задачу

- общий Undo настроек устройства;
- отмена add/delete/hide/show/rebind и создания virtual device;
- keyboard nudging стрелками — отдельный scope #41;
- server-side история между reload/remount;
- collaborative Undo между клиентами;
- объединение с geometry/decor history;
- изменение backend schema/API или миграция layout;
- расширение гарантированного touch-редактирования за пределы safety contract.

## 5. UX панели и shortcuts

В основной панели Device editor перед постоянной кнопкой закрытия появляются
постоянные icon-only кнопки Undo и Redo. Они не относятся к динамической
context tray, не меняют высоту панели и не сдвигают рабочую область.

- Undo: `mdi:undo-variant`; Redo: `mdi:redo-variant`.
- Пустая история или выполняющаяся запись: кнопка disabled.
- Доступное имя и tooltip используют существующие `history.undo_named`,
  `history.redo_named`, `history.undo_empty`, `history.redo_empty`.
- Имя команды локализуется новым ключом `history.device_move` и включает имя
  устройства, например «Перемещение: Датчик движения».
- После успеха используются `history.undone` / `history.redone`.
- `Ctrl/Cmd+Z` — Undo.
- `Ctrl/Cmd+Shift+Z` и `Ctrl+Y` — Redo.
- В `input`, `textarea`, `select` и `[contenteditable]` сохраняется нативная
  история поля.
- Shortcuts активны только при `_mode === "devices"`; View, Plan и Backdrop не
  меняют своё поведение.

Если Undo вызван во время активного drag, первый вызов только abort-ит preview.
Следующий Undo применяет последнюю завершённую команду.

## 6. Модель команды

Вводится отдельный `CommandStack<DevicePositionCommand>(50)`. Общий
`src/command-stack.ts` переиспользуется без смешивания со
`_geometryHistory`.

```ts
interface DevicePlacement {
  x: number;
  y: number;
  s?: string;
}

interface DevicePositionCommand {
  deviceId: string;
  spaceId: string;
  displayName: string;
  before: DevicePlacement | null;
  after: DevicePlacement;
}
```

`null` означает, что до ручного перемещения ключ устройства отсутствовал в
layout и маркер использовал auto-position. Команда хранит только placement;
текущие sibling-поля записи берутся в момент применения и сохраняются.

Координаты `after` — уже каноническая snapped wire-position для текущего
normalized/legacy режима. Undo/Redo не пропускает сохранённые точки через snap
повторно и не накапливает drift.

## 7. Чистые position helpers

Добавляется отдельный pure-модуль (рекомендуемо
`src/device-position-history.ts`) со следующими обязанностями:

- снять `DevicePlacement | null` с layout по stable id;
- сравнить две placement-позиции;
- применить placement к копии layout;
- при update сохранить все текущие неизвестные поля и `k`, включая `k: 0`;
- при `null` удалить весь ключ устройства, поскольку валидная persisted
  position-запись обязательно содержит `x/y`;
- не мутировать входной объект.

Room-label ids (`rl_*`) продолжают использовать свой текущий путь сохранения и
никогда не попадают в device position history.

## 8. Транзакция drag

### 8.1 Begin

После существующих permission/disabled guards `pointerdown` фиксирует stable
device id, `spaceId`, имя, pointer id и placement `before`. Пока выполняется
предыдущий финальный update/delete, новый drag не начинается: это короткая
serialisation boundary, исключающая гонку rollback с более новой командой.

### 8.2 Preview

`pointermove` применяет snap/clamp/conversion и меняет только локальный preview.
Он может запросить render, но:

- не добавляет id в `_dirtyPos`;
- не запускает debounce/persist;
- не создаёт history entry;
- полностью обратим до `before`.

### 8.3 Commit

На `pointerup` конечная placement сравнивается с `before`.

- Нет реального snapped-изменения: оставить/восстановить исходное состояние,
  не писать серверу, не добавлять command и не очищать Redo.
- Есть изменение: выполнить одну optimistic final mutation и одну точечную
  `houseplan/layout/update`. После подтверждённого успеха добавить одну named
  command. До завершения persist Undo/Redo и новые drag disabled.
- Ошибка update: вернуть `before`, не добавлять command и показать
  `toast.pos_save_failed`.

### 8.4 Abort

`pointercancel`, `lostpointercapture`, Escape, смена editor mode, disconnect,
второй pointer, а также исчезновение/HA-disable устройства во время жеста:

1. восстанавливают локальный `before`;
2. освобождают capture/drag state;
3. не создают command;
4. не отправляют финальный update/delete.

## 9. Undo/Redo и persist

Undo извлекает команду и применяет `before`, Redo — `after`.

- `before === null`: optimistic delete ключа и один
  `houseplan/layout/delete`.
- Placement: position-only merge и один `houseplan/layout/update`.
- Во время запроса history controls disabled, следующий жест не начинается.
- При успехе направление stack остаётся изменённым и показывается named toast.
- При ошибке optimistic state и направление stack восстанавливаются: failed
  Undo снова доступен как Undo, failed Redo — как Redo.
- `_sentPos` либо эквивалентная pending-authority карта должна представлять как
  update, так и delete tombstone. Layout reload не может воскресить manual
  запись, удаляемую Undo, пока delete ещё in-flight.

Команда другого пространства сначала переключает карточку на `spaceId`, чтобы
результат был виден, затем применяет изменение. Проверка выполняется по stable
device id и ожидаемому space, а не по сохранённому display name.

## 10. Невалидные команды и revisions

History session-local и сохраняется при View ↔ Devices и обычном переключении
пространств. Reload/remount её теряет.

- Own echo с тем же фактическим layout content не очищает stack.
- Reconnect с тем же content не очищает stack.
- Любой принятый authoritative layout, отличающийся от текущего optimistic
  content, conflict/reload или whole-layout replacement очищает оба направления.
- Authoritative config change, из-за которого command device удалён, сменил id,
  space или стал HA-disabled, делает команды неприменимыми.
- Перед каждым Undo/Redo устройство повторно валидируется. Stale command не
  воскрешает объект: весь position stack очищается и показывается новый
  локализованный toast `history.device_stale`.
- Новый успешный drag после Undo очищает Redo стандартным `CommandStack.push()`.

Нельзя определять own echo только по timeout/wall-clock. Используются текущие
revision/content contracts и сравнение канонического content.

## 11. Строгая граница истории

Position stack не получает команды при:

- сохранении dialog и смене entity/binding/room/HA Area;
- icon, size, rotation, display, tap action, Glow и controls;
- hide/show/delete/re-add;
- add virtual device, icon rules и Show hidden;
- auto placement, registry rebuild, optimizer/migration;
- room-label, decor, wall, opening и другой geometry drag;
- принятии remote layout.

Удаление/rebind/HA-disable устройства очищает неприменимую историю, но не
создаёт обратную команду.

## 12. Touch, accessibility и performance

- Кнопки используют существующий размер toolbar target и `focus-visible`.
- Tooltip и `aria-label` совпадают по смыслу и локализованы на EN/RU/DE/FR.
- `pointercancel`, lost capture и multitouch выполняют безопасный abort.
- Редактор остаётся desktop-first согласно `docs/TOUCH-SUPPORT.md`.
- Snapshot и apply имеют O(1) стоимость; stack ограничен 50 командами.
- Удаление persist/debounce из `pointermove` снижает объём работы во время drag.

## 13. Acceptance criteria и доказательства

| AC | Критерий | Обязательное доказательство |
| --- | --- | --- |
| AC1 | Один drag даёт одну команду и одну финальную запись; десять `pointermove` не пишут серверу | Browser smoke с fake WS/write counter |
| AC2 | Undo/Redo возвращают exact before/after для двух устройств и нескольких drag одного устройства в LIFO-порядке | Browser smoke |
| AC3 | Auto → manual → Undo удаляет ключ через delete, Redo делает update | Unit + browser smoke |
| AC4 | No-op не создаёт команду и не очищает Redo | Unit + browser smoke |
| AC5 | Cancel/lost capture/Escape/mode switch/disconnect/second pointer восстанавливают preview и дают ноль final writes | Browser smoke + source guard |
| AC6 | Undo во время drag только abort-ит его | Browser smoke |
| AC7 | Persist failure откатывает position и корректно восстанавливает направление stack | Browser smoke update/delete failure |
| AC8 | `k: 0` и неизвестные sibling-поля сохраняются; room-label не входит в history | Unit |
| AC9 | Кнопки и три shortcut работают только в Device editor; native field history не перехватывается | Browser smoke |
| AC10 | Own echo/reconnect same-content сохраняют stack, отличный remote content очищает | Browser smoke sync fixture |
| AC11 | Команда другого пространства переключает пространство и видимо применяется | Browser smoke |
| AC12 | Deleted/rebound/HA-disabled device не воскрешается, stack fail-closed очищается | Browser smoke |
| AC13 | Device toolbar сохраняет высоту и доступные имена на поддерживаемых ширинах | Golden + DOM/a11y assertions |
| AC14 | Geometry/decor Undo/Redo, pan/zoom и layout sync не регрессируют | Targeted regression smoke |

## 14. Тестовый план

### Unit

Добавить `test/device-position-history.test.mjs`:

- normalized и legacy snapshot/apply round-trip;
- absent entry;
- preservation `k`, `k: 0` и future fields;
- immutable input, equality/no-op;
- stack branch/cap покрывается существующими command-stack tests.

### Browser smoke

Добавить `demo/smoke_device_position_history.mjs`, который использует реальные
pointer events Device editor и fake WS:

- AC1–AC12, включая update/delete failures;
- кнопки, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y` и editable target;
- проверка, что `pointercancel` больше не routed в commit-handler;
- проверка двух пространств и внешней revision.

### Регрессия и gates

- `npm run typecheck`, `npm test`, production build и bundle sync;
- `node scripts/check-docs.mjs`;
- `node scripts/no-new-any.mjs`;
- `node scripts/smoke-select.mjs` и выбранный targeted smoke;
- минимум `smoke_editor_tabs`, `smoke_layout_sync`, `smoke_grid_snap`,
  `smoke_pan_any_zoom` и истории Plan/Backdrop;
- целевой Device editor golden обязателен, потому что toolbar видимо меняется;
- обновление golden/docs screenshots выполняется только каноническим Linux
  workflow с review diff и принятием через `docs:accept`.

## 15. План изменений

- `src/device-position-history.ts` — pure snapshot/apply/equality contract;
- `src/houseplan-card.ts` — stack, drag transaction, shortcuts, sync/persist;
- `src/houseplan-editor-runtime.ts` — toolbar и mode-switch abort;
- runtime host interface — типизированный history contract;
- `src/i18n/{en,ru,de,fr}.json` — имя операции и stale-state сообщение;
- unit/smoke/golden fixtures;
- пользовательская документация и changelog;
- сгенерированный `custom_components/houseplan/www/houseplan-card.js` синхронен
  с production build.

Backend и config/layout schema не изменяются.

## 16. Документация и release-артефакты

В одном user-visible implementation commit обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md` — кнопки, shortcuts, глубина 50
  и session-local граница;
- `docs/UX-MODES.md` — position-only history Device editor;
- `docs/TESTING.md` — новый smoke/golden contract;
- EN/RU/DE/FR i18n;
- reviewed Device editor golden.

Security/performance report и HA config migration не требуются. Performance
инвариант доказывается write counter: во время preview нет persist.

## 17. Риски и rollback

| Риск | Мера |
| --- | --- |
| Rollback гоняется с более новой записью | Сериализация final position writes |
| Undo стирает future fields или `k: 0` | Pure position-only merge + unit tests |
| Delete resurrected layout reload | Pending update/delete tombstone |
| Own echo очищает stack | Revision + canonical content comparison |
| Cancel коммитит случайный touch drag | Отдельный abort-handler и smoke |
| Stale command воскрешает device | Валидация stable id/space/lifecycle, fail-closed clear |
| Toolbar дёргает stage | Постоянные icon-only controls + golden |

Rollback удаляет position stack, toolbar controls и preview transaction и
возвращает прежний direct drag. Формат данных не меняется, data rollback и
миграция не нужны.

## 18. Технические предположения, которые можно менять свободно

Без дополнительного продуктового согласования реализация может изменить:

- имя и внутренний API pure-модуля `src/device-position-history.ts`;
- форму внутренних TypeScript interfaces, если сохраняется position-only
  контракт и все AC;
- способ композиции отдельного `CommandStack` с runtime host port;
- способ представления update/delete tombstone в pending-authority карте;
- момент внутреннего `requestUpdate()`, если preview и persist остаются
  визуально и транзакционно эквивалентны ТЗ.

Новый pure-модуль, две toolbar-кнопки и восемь коротких i18n-строк должны
оставаться внутри действующего `bundle:budget` (256000 B gzip). Отдельный
performance artifact не требуется, но общий budget gate обязателен.
