# ТЗ #41 — Клавиатурное редактирование выбранных объектов

- Issue: https://github.com/Matysh/houseplan-card/issues/41
- Приоритет: P2
- Статус ТЗ: prototype-first draft
- Scope: desktop editors; touch editing остаётся best-effort

## Цель Stage 1

Выбирать существующие объекты, открывать свойства, удалять и точно сдвигать их
по сетке без мыши. Полное рисование arbitrary polygon клавиатурой не входит.

## Focus model

Каждый editor предоставляет один `EditorObjectNavigator` с roving tabindex по
объектам текущего editable layer и стабильным spatial order: top→bottom,
left→right, затем id. Tab входит/выходит из navigator один раз; стрелки при
навигации выбирают соседний объект, а не прокручивают page.

Режимы:

- `navigate`: стрелки меняют selection;
- `move` после Space или явной tray action: стрелки двигают selected object;
  Escape отменяет gesture до command commit, Enter завершает.

Так устраняется конфликт «стрелка выбирает или двигает». Pointer selection
синхронизирует active descendant.

## Команды

- Enter — свойства выбранного объекта;
- Delete/Backspace — только delete выбранного через #32 там, где требуется;
- Space — начать/закончить keyboard move;
- arrows move = один grid node; Shift+arrow = 10 nodes;
- Escape — отмена move, затем selection/tool по существующему приоритету;
- Ctrl+Z/Ctrl+Shift+Z — общий named command stack.

Команды запрещены при focus в input/textarea/select/contenteditable/dialog.
Browser scroll/pan shortcuts остаются вне navigator.

## Geometry semantics

Move применяет существующие snap/validation/command APIs объекта. Room vertices
и wall resize не входят в Stage 1; целиком movable markers, openings вдоль
wall, partitions, columns и decor входят по мере наличия безопасной команды.
Невалидный move не commit-ится и объявляет причину.

## Announcements

`aria-live=polite`: выбран тип/имя; move start; координаты/длина/угол после
шага; invalid reason; Undo/Redo command name. Частые key repeats throttled, но
финальное значение всегда объявляется.

## Проверки и приёмка

- prototype доказывает отсутствие scroll/pan/form conflicts;
- navigator order после add/delete/space change;
- move every supported object, invalid/opening constraints, command undo;
- focus restore после property/confirm dialog;
- NVDA/Chrome manual checklist и browser keyboard smoke;
- unsupported object имеет свойства/delete, но не ложно доступный Move.
