<!-- release: v1.84.0-beta.3 -->
## Основное

- После сохранения переноса узла продолжают работать курсор захвата, контекстное меню и последующие перемещения. Добавлена регрессия с ответом настоящего Python-кода интеграции, Undo/Redo и повторным открытием плана.
- Optimize корректно обрабатывает почти осевые стыки и привязки проёмов; миграция старых планов сохраняет отдельные совпадающие стены с разной толщиной. Посторонний непривязанный проём больше не мешает удалению стены.
- Копирование пространства сохраняет принятую геометрию без оптимизации и новых ограничений для проёмов.
- В общих настройках появилась выключенная по умолчанию опция учитывать сводную панель при центрировании плана. У панели только с погодой остаётся один заголовок «Погода».
- Сообщения больше не переносятся в новый активный диалог; описания карточек при добавлении на панель следуют языку профиля HA.
- Исправлены мигание заливки проёмов при переключении редакторов, остающиеся следы предпросмотра стен и дублирующая обводка кнопок после Esc.
- Доработаны точная геометрия, привязки проёмов, восстановление камеры и проверки совместимости model11. Сохраняются строгие проверки целостности и прав записи.

[Подробный список изменений](https://github.com/Matysh/houseplan-card/blob/v1.84.0-beta.3/docs/CHANGELOG.ru.md)

## Highlights

- Node grab cursors, context menus and subsequent endpoint moves remain available after saving. A regression exercises production Python integration replies, Undo/Redo and reopening the plan.
- Optimize handles near-axis joints and opening bindings correctly; legacy migration preserves independent coincident walls with different thickness. An unrelated unbound opening no longer blocks deleting a wall.
- Space copying preserves accepted geometry without optimization or new opening restrictions.
- General settings add an opt-in option to account for the summary panel when centering the plan. A weather-only panel has one Weather heading.
- Messages no longer move into newly opened dialogs; dashboard card-picker descriptions follow the HA profile language.
- Fixes cover opening-fill flashes during editor transitions, retained wall previews and duplicate button outlines after Esc.
- Exact geometry, opening bindings, camera recovery and model11 compatibility checks are improved while retaining strict integrity and write-permission checks.

[Detailed changelog](https://github.com/Matysh/houseplan-card/blob/v1.84.0-beta.3/docs/CHANGELOG.md)
