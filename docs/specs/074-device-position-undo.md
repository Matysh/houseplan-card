# Issue #74 — position-only Undo/Redo в редакторе устройств

- **Issue:** https://github.com/Matysh/houseplan-card/issues/74
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** feature/polish, обычный трек
- **Пользовательское изменение:** да

## 1. Проблема

Device editor позволяет перетаскивать маркеры, но завершённый drag сразу
попадает в layout store и не оформляется как отменяемая команда. Plan и
Backdrop уже используют именованную историю, поэтому одинаковая ошибка
пользователя имеет разную цену в соседних редакторах.

Текущий путь `_savePos()` меняет `_layout` во время движения. #74 добавляет
локальную историю только ручных позиций устройств и одновременно делает drag
транзакционным с точки зрения истории и финального persist.

## 2. Цели

1. Один завершённый drag одного маркера становится одной командой.
2. Undo/Redo доступны кнопками и стандартными shortcuts только в Device editor.
3. Первый ручной drag auto-positioned устройства полностью обратим.
4. История не откатывает настройки, lifecycle или объекты других редакторов.
5. Remote layout revision безопасно инвалидирует session-local команды.

## 3. Не входит в задачу

- общий Undo всех настроек устройства;
- отмена add/delete/hide/show или virtual devices;
- keyboard nudging стрелками (#41);
- server-side история между перезагрузками;
- cross-client collaborative Undo;
- объединение с geometry history;
- изменение backend API, если текущая atomic layout write достаточна.

## 4. Пользовательский контракт

В основной панели Device editor перед Close постоянно присутствуют icon-only
кнопки Undo и Redo. Они не появляются динамически и не меняют геометрию панели.

- пустая история: disabled, tooltip/`aria-label` сообщают об отсутствии шага;
- непустая: подпись включает операцию и имя, например «Отменить: перемещение
  Датчик движения»;
- успешное применение использует существующие именованные toast;
- View, Plan и Backdrop не показывают эти кнопки и не меняют shortcuts.

Shortcuts:

- `Ctrl/Cmd+Z` — Undo;
- `Ctrl/Cmd+Shift+Z` и `Ctrl+Y` — Redo;
- `input`, `textarea`, `select`, `[contenteditable]` сохраняют native history;
- shortcut действует только когда текущий mode равен `devices`.

## 5. Модель команды

Вводится отдельный `CommandStack<DevicePositionCommand>(50)`. Переиспользуется
общий `src/command-stack.ts`, но state и apply-функции не смешиваются с
`_geometryHistory`.

```ts
interface DevicePlacementSnapshot {
  hasPlacement: boolean;
  x?: number;
  y?: number;
  s?: string;
}

interface DevicePositionCommand {
  deviceId: string;
  spaceId: string;
  displayName: string;
  before: DevicePlacementSnapshot;
  after: DevicePlacementSnapshot;
}
```

Snapshot содержит только placement-поля `x`, `y`, `s`. Признак
`hasPlacement=false` отличает auto-position от явной записи. Отображаемое имя
служит только для UI и не используется для поиска объекта.

## 6. Транзакция drag

### 6.1 Начало

`pointerdown` после существующих permission/disabled guards фиксирует:

- stable device id и space id;
- raw layout entry до preview;
- фактическую auto-position, если placement отсутствует;
- pointer id/capture и текущий snapped node.

Начало drag не меняет history и не очищает redo branch.

### 6.2 Preview

`pointermove` обновляет только локальный preview. Оно может вызывать render, но
не создаёт команду и не инициирует пользовательскую persist-транзакцию на каждом
кадре. Если текущая архитектура требует `_layout` как preview source, изменения
помечаются как uncommitted и полностью восстанавливаются при abort.

### 6.3 Commit

`pointerup` применяет существующие snap, normalized/legacy conversion, bounds и
clamp. Если конечный node отличается от исходного placement:

1. создаётся ровно одна named command;
2. очищается redo branch через `CommandStack.push()`;
3. выполняется одна финальная layout persist;
4. собственный server echo связывается с этой транзакцией.

Клик, движение ниже threshold и возврат на исходный snapped node — no-op: нет
команды, записи и очистки Redo.

### 6.4 Abort

`pointercancel`, `lostpointercapture`, Escape, смена mode во время drag и потеря
устройства восстанавливают raw before-state. Команда и финальная запись не
создаются.

Undo во время активного drag сначала abort-ит этот drag. Только следующий Undo
берёт завершённую команду из stack.

## 7. Применение Undo/Redo

- Undo применяет `before`, Redo — `after`.
- Existing/future non-placement поля layout entry сохраняются.
- Если `before.hasPlacement=false`, Undo удаляет `x/y/s`; пустой после этого
  объект удаляется, непустой сохраняет остальные поля.
- Redo восстанавливает точную конечную snapped position.
- Команда другого пространства сначала переключает карточку на `spaceId`, затем
  показывает применённый результат.
- Применение выполняет одну optimistic mutation и одну persist-транзакцию.
- Ошибка persist откатывает optimistic state либо запускает текущий
  conflict/reload flow; неприменимая команда не остаётся в history.

Нельзя пропускать координаты через snap второй раз так, чтобы round-trip менял
их. Conversion обязан быть идемпотентным для уже сохранённого значения.

## 8. Строгая граница истории

Position stack не получает команды при:

- save device dialog и изменении binding/entity/room/HA Area;
- icon, size, rotation, display, tap action, Glow и controls;
- hide/show/delete/re-add;
- add virtual device и icon rules;
- Show hidden;
- auto placement, registry rebuild, optimizer/migration;
- room-label, decor, wall, opening и другой geometry drag;
- remote layout adoption.

HA-disabled устройство не начинает drag. Hidden ghost, если текущий UI уже
разрешает его перемещение, использует обычную position-команду.

## 9. Revision и lifecycle

- stack session-local и живёт в экземпляре карточки;
- View ↔ Devices и space switch не очищают его сами по себе;
- собственный echo после успешной persist не очищает stack;
- более новая внешняя layout revision, conflict/reload или полная замена layout
  очищает Undo и Redo;
- новый manual drag после Undo очищает redo branch;
- удалённое, HA-disabled или сменившее stable id устройство не воскрешается;
  команда признаётся stale, stack очищается, показывается локализованный toast;
- disconnect/remount не сериализует history.

Различение own echo и external revision переиспользует существующий revision
contract, а не timeout или сравнение wall-clock.

## 10. Touch и accessibility

View/touch contract не меняется. В desktop-first Device editor:

- кнопки имеют стабильный размер touch target и видимый `focus-visible`;
- их доступное имя совпадает с tooltip;
- pointercancel/multitouch не коммитят случайную позицию;
- второй pointer отменяет single-device drag либо следует текущему safety guard;
- toolbar не перекрывает stage при узкой ширине.

## 11. Acceptance criteria

1. Один drag даёт одну команду; Undo/Redo возвращают exact before/after.
2. Десять `pointermove` не дают десять history entries или persist writes.
3. Два устройства отменяются в обратном порядке.
4. Несколько drag одного устройства являются отдельными командами.
5. Первый drag auto-positioned marker: Undo возвращает auto-position без explicit
   placement, Redo восстанавливает manual placement.
6. No-op drag не включает Undo и не очищает Redo.
7. Cancel/Escape/mode switch восстанавливают before-state без записи.
8. Undo во время drag только abort-ит текущую транзакцию.
9. Shortcuts не перехватывают native field history.
10. Кнопки постоянны, доступны с клавиатуры и имеют именованные labels/toasts.
11. Unknown layout fields и device settings не меняются.
12. Own echo сохраняет stack; external revision очищает.
13. Команда другого этажа делает результат видимым.
14. Удалённый/disabled/rebound объект не воскрешается.
15. Geometry/decor history и View shortcuts сохраняют прежний контракт.

## 12. План тестирования

### Unit

- apply before/after к raw entry с future fields;
- absent-entry round-trip;
- no-op и redo invalidation;
- 50-command cap;
- own/external revision policy;
- stale device invalidation;
- normalization round-trip.

### Browser smoke

- два устройства и несколько drag;
- кнопки и все три shortcut;
- auto-position → manual → Undo → Redo;
- cancel/Escape/lost capture;
- другое пространство;
- native input history;
- own echo, remote revision и удалённый device;
- narrow toolbar и touch pointercancel.

### Регрессия

- `smoke_editor_tabs`, `smoke_layout_sync`, `smoke_grid_snap`,
  `smoke_pan_any_zoom`;
- geometry/decor Undo/Redo;
- typecheck, unit и production build.

Golden не требуется, если toolbar укладывается без изменения принятой
геометрии. Если кнопки меняют видимый baseline, обновляется только точечная
editor-сцена с review diff.

## 13. План реализации

1. Ввести pure placement snapshot/apply helpers и unit tests.
2. Добавить отдельный stack и revision invalidation.
3. Разделить device drag на begin/preview/commit/abort.
4. Подключить Undo/Redo apply с persist rollback.
5. Добавить toolbar buttons, shortcuts, i18n и toasts.
6. Прогнать targeted smoke и общий implementation gate.

## 14. Документация и release-артефакты

- оба changelog получают user-visible пункт в том же implementation commit;
- `docs/USER-GUIDE.ru.md` описывает кнопки, shortcuts, глубину 50 и session-local
  границу;
- `docs/TESTING.md` получает position-history smoke contract;
- новые RU/EN keys обязательны;
- screenshot/golden нужен только при реальном изменении toolbar baseline;
- backend, schema migration, security artifact и full HA harness не требуются.

## 15. Риски и откат

| Риск | Мера |
| --- | --- |
| Preview пишет store на каждом кадре | явная transaction boundary + write spy |
| Undo стирает future fields | placement-only merge tests |
| Own echo очищает историю | revision origin contract |
| Remote command воскрешает device | stable-id validation before apply |
| Shortcuts ломают поля/Plan | mode + editable-target matrix |

Откат удаляет position stack и toolbar и возвращает прежний direct drag. Формат
layout не меняется, поэтому data rollback не нужен.

## 16. Принятые технические предположения

- текущая atomic layout write достаточна;
- displayName в старой команде не обновляется при rename;
- external HA Area move не является Undo-командой;
- переключение пространства для применения повторяет существующую geometry
  history semantics.
