# Settings dialogs redesign: материалы для issue и реализации

Дата: 18.09.2026. Сверено с `Matysh/houseplan-card` dev `9683a59` (v1.76.0). Изменение только UI.

```
ISSUE-FORM.md            текст для трёх полей формы Feature request (Title, What problem, How it works)
SPEC.md                  подробное ТЗ на четыре диалога в структуре PROCESS.md §7.1 (сценарий, до/после,
                         скоуп, визуальная система, состав каждого диалога, i18n, AC, риски, предположения)
IMPLEMENTATION-GUIDE.md  для Claude, который будет реализовывать: где что в коде, порядок работ,
                         маппинг каждого контрола на ключи состояния, что прототип не показывает, чек-лист PR
OPEN-POINTS.md           места, где прототип задевает поведение: реализующая сессия Claude уточняет их у JB в чате
docs/FIELD-MAP-space.md  полная карта полей Space settings (прототип → SpaceDialogState → i18n → контрол)
reference/               интерактивный прототип четырёх форм (дизайн-референс, не продуктовый код)
  index.html, styles.css, ui.js (иконки, «?»-подсказки, toast), demo-shell.js (переключатель форм)
  app.js (Space settings), general-settings.js, room-settings.js, device-settings.js
  room-fill.js + room-fill.test.mjs (сверка семантики заливок), serve.mjs, START.cmd/.ps1, assets/
screenshots/             четыре формы целиком, 560 px, 2x, состояние по умолчанию
```

## Как открыть прототип

```
cd reference
node serve.mjs        # http://127.0.0.1:8135/ ; file:// не работает (ES-модули)
```

Кнопка «Open preview» или переключатель «Form» вверху: Space settings, General settings, Room settings, Device on the plan. Данные форм хранятся в localStorage браузера; для чистого состояния открывать в приватном окне.

## Как использовать

1. Создать issue из `ISSUE-FORM.md`, приложить этот архив и четыре PNG из `screenshots/`.
2. Когда владелец примет задачу и дойдёт до этапа ТЗ, `SPEC.md` вставляется в тело issue под `## ТЗ` (там уже нужная структура).
3. Реализация по `IMPLEMENTATION-GUIDE.md` только после метки `S5-ready` (Rule #1 в AGENTS.md). Меняется только UI форм; спорные места из `OPEN-POINTS.md` реализующая сессия Claude уточняет у JB в чате, не у владельца.
